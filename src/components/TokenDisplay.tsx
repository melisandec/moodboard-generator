"use client";

import { useEffect, useState } from "react";
import { getSDK } from "@/lib/farcaster-sdk-init";

/**
 * Token Display Component
 * Shows Farcaster auth token and provides copy functionality
 */
export function TokenDisplay() {
  const [token, setToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const sdk = getSDK();
        if (!sdk) {
          setError("SDK not initialized");
          setIsLoading(false);
          return;
        }

        const authTokenResponse = await sdk.quickAuth.getToken();
        if (authTokenResponse && authTokenResponse.token) {
          setToken(authTokenResponse.token);
          console.log("🎫 Auth Token:", authTokenResponse.token);
        } else {
          setError("No token available - not in Warpcast context");
        }
      } catch (err) {
        console.error("Token fetch error:", err);
        setError("Token not available in this context");
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure SDK is initialized
    const timer = setTimeout(fetchToken, 500);
    return () => clearTimeout(timer);
  }, []);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {token && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-semibold text-green-900">
                Auth Token Ready ✅
              </p>
              <p className="text-xs text-green-700 mt-1 font-mono truncate">
                {token.substring(0, 20)}...
              </p>
            </div>
            <button
              onClick={copyToken}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded whitespace-nowrap transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-green-600 mt-2">
            Token copied to clipboard. Use:{" "}
            <code className="bg-green-100 px-1 rounded">npm run test:api</code>
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
          <p className="text-sm text-blue-900 font-semibold">
            🔄 Initializing SDK...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
          <p className="text-sm font-semibold text-yellow-900">ℹ️ {error}</p>
          <p className="text-xs text-yellow-700 mt-1">
            Open DevTools (Warpcast Simulator) to access token via:{" "}
            <code className="bg-yellow-100 px-1 rounded">
              await sdk.quickAuth.getToken()
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
