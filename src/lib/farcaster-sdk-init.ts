/**
 * Farcaster Mini App SDK Initialization
 * Exposes SDK globally for console access and Warpcast integration
 */

import sdk from "@farcaster/miniapp-sdk";

type MiniAppSDK = typeof sdk;

let sdkInitialized = false;

export async function initializeFarcasterSDK(): Promise<MiniAppSDK> {
  try {
    // Expose SDK to window for console access
    if (typeof window !== "undefined") {
      (window as any).sdk = sdk;

      if (!sdkInitialized) {
        console.log("✅ Farcaster SDK exposed globally");
        console.log("💡 Use in console: await sdk.quickAuth.getToken()");
        sdkInitialized = true;
      }
    }

    return sdk;
  } catch (error) {
    console.error("❌ Failed to initialize Farcaster SDK:", error);
    throw error;
  }
}

export function getSDK(): MiniAppSDK {
  return sdk;
}
