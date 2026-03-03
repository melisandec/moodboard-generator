"use client";

import { useEffect } from "react";
import { initializeFarcasterSDK } from "@/lib/farcaster-sdk-init";

/**
 * Client-side SDK Initializer
 * Initializes Farcaster SDK on app load and exposes it globally
 */
export function SDKInitializer() {
  useEffect(() => {
    let mounted = true;

    const setupSDK = async () => {
      try {
        const sdk = await initializeFarcasterSDK();

        // Log ready state
        if (mounted) {
          console.log("🚀 Farcaster Mini App Ready");
          console.log("📝 To get auth token, run in console:");
          console.log("   const token = await sdk.quickAuth.getToken();");
          console.log("   console.log(token);");
        }
      } catch (error) {
        console.error("SDK initialization error:", error);
      }
    };

    setupSDK();

    return () => {
      mounted = false;
    };
  }, []);

  // Render nothing - this is just for initialization
  return null;
}
