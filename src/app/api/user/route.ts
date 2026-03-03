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
      contentType: req.headers.get("content-type"),
      authorization: req.headers.get("authorization")
        ? `${req.headers.get("authorization")!.substring(0, 20)}...`
        : "missing",
    });

    if (!checkOrigin(req)) {
      console.warn(
        "[/api/user] ❌ Origin check failed:",
        req.headers.get("origin"),
      );
      return originDenied();
    }

    // Step 1: Verify authentication
    let auth: { fid: number } | null;
    try {
      auth = await verifyAuth(req);
    } catch (authErr) {
      console.error("[/api/user] ❌ verifyAuth threw:", authErr);
      return NextResponse.json(
        { error: "Auth verification error", details: String(authErr) },
        { status: 500 },
      );
    }

    if (!auth) {
      console.warn("[/api/user] ❌ Auth verification returned null");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[/api/user] ✓ Auth verified for FID:", auth.fid);
    const fid = String(auth.fid);

    // Step 2: Parse request body (gracefully — body may be empty or malformed)
    let username = "";
    let pfpUrl = "";
    try {
      const bodyRaw = await req.json();
      username = bodyRaw?.username ?? "";
      pfpUrl = bodyRaw?.pfpUrl ?? "";
      console.log("[/api/user] ✓ Body parsed:", {
        hasUsername: !!username,
        hasPfpUrl: !!pfpUrl,
      });
    } catch (parseErr) {
      // Body parsing failed — this is OK, we can still register the user
      // with just the FID from the auth token
      console.warn("[/api/user] ⚠ Body parse failed (will use defaults):", {
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        type:
          parseErr instanceof Error
            ? parseErr.constructor.name
            : typeof parseErr,
      });
    }

    // Step 3: Database operations
    let db;
    try {
      db = getDb();
      console.log("[/api/user] ✓ Database connection established");
    } catch (dbErr) {
      console.error("[/api/user] ❌ Database connection failed:", dbErr);
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: dbErr instanceof Error ? dbErr.message : String(dbErr),
        },
        { status: 500 },
      );
    }

    try {
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
            username: username || existing.username,
            pfpUrl: pfpUrl || existing.pfpUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.fid, fid));
        console.log("[/api/user] ✓ User updated successfully");
      } else {
        console.log("[/api/user] No existing user found, creating new user...");
        const now = new Date();
        await db.insert(users).values({
          fid,
          username,
          pfpUrl,
          bio: "",
          socialLinks: {},
          followerCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        console.log("[/api/user] ✓ New user created successfully");
      }
    } catch (dbOpErr) {
      console.error("[/api/user] ❌ Database operation failed:", {
        error: dbOpErr instanceof Error ? dbOpErr.message : String(dbOpErr),
        stack: dbOpErr instanceof Error ? dbOpErr.stack : "",
        type:
          dbOpErr instanceof Error ? dbOpErr.constructor.name : typeof dbOpErr,
      });
      return NextResponse.json(
        {
          error: "Database operation failed",
          details: dbOpErr instanceof Error ? dbOpErr.message : String(dbOpErr),
          type:
            dbOpErr instanceof Error
              ? dbOpErr.constructor.name
              : typeof dbOpErr,
        },
        { status: 500 },
      );
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

    console.error(`[/api/user] ❌ UNEXPECTED ERROR (${duration}ms)`, {
      type: errorType,
      message: errorMsg,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: "User registration failed",
        details: errorMsg,
        type: errorType,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fid = String(auth.fid);
    const db = getDb();
    const user = await db.select().from(users).where(eq(users.fid, fid)).get();

    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("[/api/user GET] ❌ Error:", err);
    return NextResponse.json(
      { error: "Failed to get user", details: String(err) },
      { status: 500 },
    );
  }
}
