import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

export function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("❌ TURSO_DATABASE_URL is not configured");
    throw new Error(
      "Database URL not configured. Check TURSO_DATABASE_URL env var.",
    );
  }
  if (!authToken) {
    console.error("❌ TURSO_AUTH_TOKEN is not configured");
    throw new Error(
      "Database auth token not configured. Check TURSO_AUTH_TOKEN env var.",
    );
  }

  try {
    console.debug(`🔌 Connecting to database: ${url.substring(0, 50)}...`);
    return createClient({ url, authToken });
  } catch (err) {
    console.error("❌ Failed to create database client:", err);
    throw new Error(`Database connection failed: ${err}`);
  }
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    try {
      _db = drizzle(getClient(), { schema });
      console.debug("✓ Database initialized");
    } catch (err) {
      console.error("❌ Failed to initialize database:", err);
      throw err;
    }
  }
  return _db;
}
