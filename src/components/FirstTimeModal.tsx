"use client";

import { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface FirstTimeModalProps {
  onDismiss?: () => void;
}

const FIRST_TIME_KEY = "moodboard-first-visit";

export function FirstTimeModal({ onDismiss }: FirstTimeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkFirstVisit = async () => {
      const hasVisited = localStorage.getItem(FIRST_TIME_KEY);

      if (!hasVisited) {
        try {
          const inMiniApp = await sdk.isInMiniApp();
          setIsMiniApp(inMiniApp);
          setIsOpen(true);
          localStorage.setItem(FIRST_TIME_KEY, "true");
        } catch {
          console.log("Not in mini app context");
          setIsOpen(false);
        }
      }
    };

    checkFirstVisit();
  }, []);

  const handleAddToCollection = async () => {
    try {
      setIsLoading(true);
      // Signal to Warpcast to add this app to favorites
      // This uses the mini app SDK to communicate back to Warpcast
      await sdk.actions.ready?.();

      // In Warpcast, users typically pin apps through a long-press or
      // through Warpcast's app management interface
    } catch (err) {
      console.error("Error adding to collection:", err);
    } finally {
      setIsLoading(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-sm mx-4 shadow-lg">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome! 🎨
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            Create beautiful moodboard collages
          </p>
        </div>

        {/* Content */}
        <div className="mb-6 space-y-3 text-gray-700 dark:text-gray-300 text-sm">
          <div className="flex gap-2">
            <span className="text-xl">📤</span>
            <p>Upload up to 20 images</p>
          </div>
          <div className="flex gap-2">
            <span className="text-xl">🎯</span>
            <p>Arrange manually or auto-generate layouts</p>
          </div>
          <div className="flex gap-2">
            <span className="text-xl">✨</span>
            <p>Customize & share to Farcaster</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isMiniApp && (
            <button
              onClick={handleAddToCollection}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {isLoading ? "Adding..." : "Add to Favorites"}
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-full bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {isMiniApp ? "Start Creating" : "Get Started"}
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          {isMiniApp
            ? "You can find this app anytime in Warpcast"
            : "Open this link in Warpcast to get started"}
        </p>
      </div>
    </div>
  );
}
