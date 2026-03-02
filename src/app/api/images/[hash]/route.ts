import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { images } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;
    const db = getDb();

    const image = await db
      .select()
      .from(images)
      .where(eq(images.hash, hash))
      .get();

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Redirect to the stored URL
    return NextResponse.redirect(new URL(image.url), {
      status: 302,
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 },
    );
  }
}
