"use client";

import { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface FirstTimeModalProps {
  onDismiss?: () => void;
  onAddedToCollection?: () => void;
}

const FIRST_TIME_KEY = "moodboard-first-visit";
const ADDED_TO_COLLECTION_KEY = "moodboard-added-to-collection";

export function FirstTimeModal({
  onDismiss,
  onAddedToCollection,
}: FirstTimeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsMiniApp(inMiniApp);

        const alreadyConfirmed =
          localStorage.getItem(ADDED_TO_COLLECTION_KEY) === "true";

        // For mini app: always show modal if they haven't confirmed adding to collection
        if (inMiniApp) {
          setIsOpen(!alreadyConfirmed);
        } else {
          // For non-mini app: only show once on first visit
          const hasVisited = localStorage.getItem(FIRST_TIME_KEY);
          if (!hasVisited) {
            setIsOpen(true);
          }
        }
      } catch {
        console.log("Not in mini app context");
        setIsOpen(false);
      }
    };

    checkFirstVisit();
  }, []);

  const handleAddToCollection = async () => {
    try {
      setIsLoading(true);
      // Set the flag indicating user has confirmed adding to collection
      // Note: User must manually pin this app in Warpcast's app management
      localStorage.setItem(ADDED_TO_COLLECTION_KEY, "true");
      onAddedToCollection?.();
      handleClose();
    } catch (err) {
      console.error("Error confirming collection:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem(FIRST_TIME_KEY, "true");
    setIsOpen(false);
    onDismiss?.();
  };

  const handleAlreadyAdded = () => {
    localStorage.setItem(ADDED_TO_COLLECTION_KEY, "true");
    localStorage.setItem(FIRST_TIME_KEY, "true");
    onAddedToCollection?.();
    handleClose();
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
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>📌 To pin:</strong> Long-press this app in Warpcast or
                  go to settings
                </p>
              </div>
              <button
                onClick={handleAddToCollection}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                {isLoading ? "Confirming..." : "I've Pinned It"}
              </button>
              <button
                onClick={handleAlreadyAdded}
                disabled={isLoading}
                className="w-full bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-60"
              >
                Skip for now
              </button>
            </>
          )}
          {!isMiniApp && (
            <button
              onClick={handleClose}
              className="w-full bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition"
            >
              Get Started
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          {isMiniApp
            ? "Pin this app to unlock generation"
            : "Open this link in Warpcast to get started"}
        </p>
      </div>
    </div>
  );
}
