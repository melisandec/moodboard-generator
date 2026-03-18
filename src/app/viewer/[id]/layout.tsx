import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { moodboards } from "@/lib/schema";
import { eq } from "drizzle-orm";

const APP_URL = (() => {
  const d =
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    "moodboard-generator-phi.vercel.app";
  return d.startsWith("http") ? d : `https://${d}`;
})();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const db = getDb();
  const board = await db
    .select({
      title: moodboards.title,
      caption: moodboards.caption,
      previewUrl: moodboards.previewUrl,
      background: moodboards.background,
    })
    .from(moodboards)
    .where(eq(moodboards.id, id))
    .get();

  const title = board?.title ?? "Moodboard";
  const description = board?.caption || "View this moodboard on Moodboard Generator";
  // Use the board's IPFS preview if available, else fall back to app OG image
  const imageUrl = board?.previewUrl ?? `${APP_URL}/og.png`;
  const bgColor = board?.background ?? "#f5f5f4";

  // Farcaster Frame v2 (Mini App embed) — opens the mini app when tapped in a cast
  const frameEmbed = {
    version: "next",
    imageUrl,
    button: {
      title: "Open in Moodboard",
      action: {
        type: "launch_frame",
        name: "Moodboard Generator",
        url: `${APP_URL}/?board=${id}`,
        splashImageUrl: `${APP_URL}/icon.png`,
        splashBackgroundColor: bgColor,
      },
    },
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: "website",
      url: `${APP_URL}/viewer/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    other: {
      // Farcaster reads this meta tag to render the Mini App embed in casts
      "fc:frame": JSON.stringify(frameEmbed),
    },
  };
}

export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
