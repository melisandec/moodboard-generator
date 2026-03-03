import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    console.log(`[/api/user] POST request started`, {
      timestamp: new Date().toISOString(),
      origin: req.headers.get("origin"),
      authorization: req.headers.get("authorization")?.substring(0, 20) + "...",
    });

    if (!checkOrigin(req)) {
      console.warn(
        "[/api/user] ❌ Origin check failed:",
        req.headers.get("origin"),
      );
      return originDenied();
    }

    const auth = await verifyAuth(req);
    if (!auth) {
      console.warn("[/api/user] ❌ Auth verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[/api/user] ✓ Auth verified for FID:", auth.fid);

    const bodyRaw = await req.json();
    console.log("[/api/user] Request body:", {
      hasUsername: !!bodyRaw.username,
      hasPfpUrl: !!bodyRaw.pfpUrl,
    });

    const { username, pfpUrl } = bodyRaw;
    const fid = String(auth.fid);

    console.log("[/api/user] Initializing database connection...");
    const db = getDb();
    console.log("[/api/user] ✓ Database connection established");

    console.log("[/api/user] Checking for existing user with FID:", fid);
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .get();

    if (existing) {
      console.log("[/api/user] ✓ Found existing user, updating...");
      await db
        .update(users)
        .set({
          username: username ?? existing.username,
          pfpUrl: pfpUrl ?? existing.pfpUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.fid, fid));
      console.log("[/api/user] ✓ User updated successfully");
    } else {
      console.log("[/api/user] No existing user found, creating new user...");
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
      console.log("[/api/user] ✓ New user created successfully");
    }

    console.log(`[/api/user] ✅ SUCCESS (${Date.now() - startTime}ms)`, {
      fid,
    });
    return NextResponse.json({ ok: true, fid });
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    const errorType = err instanceof Error ? err.constructor.name : typeof err;

    console.error(`[/api/user] ❌ ERROR (${duration}ms)`, {
      type: errorType,
      message: errorMsg,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    // Provide specific error context
    let details = errorMsg;
    if (errorMsg.includes("TURSO_DATABASE_URL")) {
      details = "Database URL not configured - check Vercel env vars";
    } else if (errorMsg.includes("TURSO_AUTH_TOKEN")) {
      details = "Database auth token not configured - check Vercel env vars";
    } else if (errorMsg.includes("SERVER_ERROR") || errorMsg.includes("404")) {
      details = "Database connection failed - verify Turso database status";
    } else if (errorMsg.includes("JWT") || errorMsg.includes("token")) {
      details = "Authentication token verification failed";
    }

    return NextResponse.json(
      {
        error: "User registration failed",
        details,
        type: errorType,
      },
      { status: 500 },
    );
  }
}
