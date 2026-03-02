import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { username, pfpUrl } = await req.json();
    const fid = String(auth.fid);

    const db = getDb();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .get();

    if (existing) {
      await db
        .update(users)
        .set({
          username: username ?? existing.username,
          pfpUrl: pfpUrl ?? existing.pfpUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.fid, fid));
    } else {
      const now = new Date();
      await db.insert(users).values({
        fid,
        username: username ?? "",
        pfpUrl: pfpUrl ?? "",
        bio: "",
        socialLinks: {},
        followerCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true, fid });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    console.error("❌ User upsert error:", errorMsg);
    console.error("Stack:", errorStack);
    return NextResponse.json(
      { error: "User registration failed", details: errorMsg },
      { status: 500 },
    );
  }
}
