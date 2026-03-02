// Phase 4: Query response caching utility for optimization
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number; // time-to-live in milliseconds
};

class ResponseCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string | RegExp): void {
    const regex =
      typeof pattern === "string"
        ? new RegExp(pattern.replace(/\*/g, ".*"))
        : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Utility for cached API fetches
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached) {
      console.log(`Cache hit: ${key}`);
      return cached;
    }

    // Fetch and cache
    console.log(`Cache miss: ${key}, fetching...`);
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
}

// Export singleton instance
export const responseCache = new ResponseCache();

// Utility function for generating cache keys
export function getCacheKey(
  endpoint: string,
  params: Record<string, any> = {},
): string {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return queryString ? `${endpoint}?${queryString}` : endpoint;
}
