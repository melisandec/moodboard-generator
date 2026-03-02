"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface BoardData {
  id: string;
  title: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
  previewImages: Array<{
    id: string;
    imageHash: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  viewCount?: number;
  createdAt?: string;
}

interface ImageData {
  id: string;
  url: string;
}

export default function BoardViewer() {
  const params = useParams();
  const boardId = params.id as string;
  const [board, setBoard] = useState<BoardData | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;

    const fetchBoard = async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}`);
        if (!res.ok) throw new Error("Board not found");
        const data = await res.json();
        setBoard(data);

        // Fetch image URLs - the API endpoints will redirect to the actual image URLs
        if (data.previewImages && Array.isArray(data.previewImages)) {
          const imageMap: Record<string, string> = {};
          for (const img of data.previewImages) {
            try {
              // First try to fetch the image data
              const imgRes = await fetch(`/api/images/${img.imageHash}`, {
                redirect: "follow",
              });
              if (imgRes.ok) {
                const blob = await imgRes.blob();
                imageMap[img.imageHash] = URL.createObjectURL(blob);
              }
            } catch (e) {
              console.warn(`Failed to load image ${img.imageHash}`, e);
              // Try direct CORS fetch as fallback
              try {
                const blob = await fetch(`/api/images/${img.imageHash}`, {
                  redirect: "follow",
                  mode: "cors",
                }).then((r) => r.blob());
                imageMap[img.imageHash] = URL.createObjectURL(blob);
              } catch (e2) {
                console.warn(`CORS fetch also failed for ${img.imageHash}`, e2);
                // Use API redirect URL as final fallback
                imageMap[img.imageHash] = `/api/images/${img.imageHash}`;
              }
            }
          }
          setImages(imageMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load board");
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [boardId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <div className="text-neutral-400">Loading board...</div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 gap-4">
        <div className="text-neutral-300 text-lg">📌 {error || "Board not found"}</div>
        <Link href="/" className="text-blue-500 hover:text-blue-400 underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-blue-500 hover:text-blue-400 text-sm mb-4 inline-block">
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">{board.title}</h1>
          {board.description && (
            <p className="text-neutral-400 mb-2">{board.description}</p>
          )}
          {board.viewCount !== undefined && (
            <p className="text-sm text-neutral-500">👁️ {board.viewCount} views</p>
          )}
        </div>

        {/* Canvas Container */}
        <div
          className="relative bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 shadow-xl"
          style={{
            aspectRatio: `${board.canvasWidth} / ${board.canvasHeight}`,
            maxWidth: "100%",
            position: "relative",
          }}
        >
          {/* Render all preview images as absolutely positioned divs */}
          <div
            className="relative w-full h-full"
            style={{
              backgroundColor: "#1a1a1a",
              position: "relative",
            }}
          >
            {board.previewImages.map((img) => {
              const url = images[img.imageHash];
              if (!url) return null;

              return (
                <div
                  key={img.id}
                  style={{
                    position: "absolute",
                    left: `${(img.x / board.canvasWidth) * 100}%`,
                    top: `${(img.y / board.canvasHeight) * 100}%`,
                    width: `${(img.width / board.canvasWidth) * 100}%`,
                    height: `${(img.height / board.canvasHeight) * 100}%`,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={url}
                    alt={`Image ${img.id}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      console.error(`Failed to load image ${img.imageHash}`, e);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Image Count */}
        <div className="mt-4 text-sm text-neutral-400">
          {board.previewImages.length} image{board.previewImages.length !== 1 ? "s" : ""} on canvas
        </div>
      </div>
    </div>
  );
}
