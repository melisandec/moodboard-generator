import { useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { renderManualMoodboard, renderMoodboardToBlob } from "@/lib/canvas";
import { renderMoodboardToBlobOffscreen } from "@/lib/canvas-offscreen";
import { clearDraft, type CanvasImage } from "@/lib/storage";

interface ExportConfig {
  title: string;
  caption: string;
  view: string;
  canvasImages: CanvasImage[];
  dimsW: number;
  dimsH: number;
  bgColor: string;
  imageMargin: boolean;
  moodboardUrl: string | null;
}

/**
 * Handles all export-related operations: download, print, and Farcaster cast.
 */
export function useCanvasExport(config: ExportConfig) {
  const {
    title,
    caption,
    view,
    canvasImages,
    dimsW,
    dimsH,
    bgColor,
    imageMargin,
    moodboardUrl,
  } = config;
  const [castStatus, setCastStatus] = useState<string | null>(null);

  const saveImage = useCallback(
    async (dataUrl: string) => {
      const filename = `${title.trim().replace(/\s+/g, "-").toLowerCase() || "moodboard"}.png`;

      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch {
        // share cancelled or unsupported — fall through to download
      }

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [title],
  );

  const printUrl = useCallback(
    (url: string) => {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(
        `<!DOCTYPE html><html><head><title>${title || "Moodboard"}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}img{max-width:100%;max-height:100vh;object-fit:contain}@media print{body{min-height:auto}img{max-height:none;width:100%}}</style></head><body><img src="${url}"/><script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`,
      );
      w.document.close();
    },
    [title],
  );

  const castToFarcaster = useCallback(async () => {
    let text = title.trim();
    if (caption.trim()) text += `\n\n${caption.trim()}`;

    setCastStatus("Rendering image…");
    let imageUrl: string | undefined;

    try {
      let blob: Blob | null = null;

      if (view === "manual" && canvasImages.length > 0) {
        blob = await renderMoodboardToBlobOffscreen(
          canvasImages,
          title.trim(),
          caption.trim(),
          dimsW,
          dimsH,
          bgColor,
          imageMargin,
          0.85,
          () =>
            renderMoodboardToBlob(
              canvasImages,
              title.trim(),
              caption.trim(),
              dimsW,
              dimsH,
              bgColor,
              imageMargin,
            ),
        );
      } else if (moodboardUrl) {
        const res = await fetch(moodboardUrl);
        blob = await res.blob();
      }

      if (blob) {
        setCastStatus("Uploading image…");
        const formData = new FormData();
        formData.append("file", blob, "moodboard.jpg");

        const uploadRes = await fetch("/api/cast-image", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const json = await uploadRes.json();
          imageUrl = json.url;
        } else {
          const errBody = await uploadRes.text().catch(() => "");
          console.error(
            "Cast image upload response:",
            uploadRes.status,
            errBody,
          );
        }
      }
    } catch (err) {
      console.error("Cast image upload failed:", err);
    }

    if (!imageUrl) {
      setCastStatus("Image upload failed — casting without image");
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      setCastStatus("Opening cast composer…");
    }

    try {
      await sdk.actions.composeCast({
        text,
        embeds: imageUrl ? [imageUrl] : [],
      });
    } catch {
      const params = new URLSearchParams({ text });
      if (imageUrl) params.append("embeds[]", imageUrl);
      window.open(
        `https://warpcast.com/~/compose?${params.toString()}`,
        "_blank",
      );
    }

    setCastStatus(null);
    clearDraft().catch(() => {});
  }, [
    title,
    caption,
    view,
    canvasImages,
    dimsW,
    dimsH,
    bgColor,
    imageMargin,
    moodboardUrl,
  ]);

  const downloadAuto = useCallback(() => {
    if (moodboardUrl) saveImage(moodboardUrl);
  }, [moodboardUrl, saveImage]);
  const printAuto = useCallback(() => {
    if (moodboardUrl) printUrl(moodboardUrl);
  }, [moodboardUrl, printUrl]);

  const downloadManual = useCallback(async () => {
    const url = await renderManualMoodboard(
      canvasImages,
      title.trim(),
      caption.trim(),
      dimsW,
      dimsH,
      bgColor,
      imageMargin,
    );
    saveImage(url);
    clearDraft().catch(() => {});
  }, [
    canvasImages,
    title,
    caption,
    dimsW,
    dimsH,
    bgColor,
    imageMargin,
    saveImage,
  ]);

  const printManual = useCallback(async () => {
    const url = await renderManualMoodboard(
      canvasImages,
      title.trim(),
      caption.trim(),
      dimsW,
      dimsH,
      bgColor,
      imageMargin,
    );
    printUrl(url);
  }, [
    canvasImages,
    title,
    caption,
    dimsW,
    dimsH,
    bgColor,
    imageMargin,
    printUrl,
  ]);

  return {
    castStatus,
    saveImage,
    printUrl,
    castToFarcaster,
    downloadAuto,
    printAuto,
    downloadManual,
    printManual,
  };
}
