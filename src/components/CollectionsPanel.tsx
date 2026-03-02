"use client";

import { useState, useEffect } from "react";

interface Collection {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CollectionsPanelProps {
  isOpen: boolean;
}

export function CollectionsPanel({ isOpen }: CollectionsPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCollections = async () => {
      try {
        const response = await fetch("/api/collections");
        if (!response.ok) throw new Error("Failed to fetch collections");

        const data = await response.json();
        setCollections(data.collections || []);
      } catch (error) {
        console.error("Collections error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [isOpen]);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCollectionName,
          description: "",
          isPublic: false,
        }),
      });

      if (response.ok) {
        setNewCollectionName("");
        setShowForm(false);
        // Refresh collections
        const refreshResponse = await fetch("/api/collections");
        const data = await refreshResponse.json();
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error("Create collection error:", error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-500">⏳ Loading collections...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          📚 Collections ({collections.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          {showForm ? "✕" : "+ New"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Collection name..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || creating}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {creating ? "⏳ Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewCollectionName("");
              }}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <p className="text-gray-500">
          📚 No collections yet. Create one to organize your boards!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {collection.description}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  {collection.isPublic ? "🌐 Public" : "🔒 Private"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-3">
                Updated {new Date(collection.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
