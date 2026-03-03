import { createClient } from "@libsql/client";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const migrations = [
  // === USERS TABLE: add missing columns ===
  `ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN social_links TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE users ADD COLUMN follower_count INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`,

  // Backfill updated_at from created_at for existing users
  `UPDATE users SET updated_at = created_at WHERE updated_at = 0`,

  // === MOODBOARDS TABLE: add missing columns ===
  `ALTER TABLE moodboards ADD COLUMN folder_id TEXT REFERENCES folders(id)`,

  // === COLLECTIONS TABLE: add cover_board_id if missing ===
  `ALTER TABLE collections ADD COLUMN cover_board_id TEXT REFERENCES moodboards(id)`,

  // === COLLECTION_ITEMS TABLE: add order column if missing ===
  `ALTER TABLE collection_items ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0`,

  // === Create tables that might be missing ===
  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    fid TEXT NOT NULL REFERENCES users(fid),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_public INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS folders_fid_idx ON folders(fid)`,
  `CREATE INDEX IF NOT EXISTS folders_public_idx ON folders(is_public)`,

  `CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES moodboards(id),
    fid TEXT NOT NULL REFERENCES users(fid),
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS reactions_board_idx ON reactions(board_id)`,
  `CREATE INDEX IF NOT EXISTS reactions_fid_idx ON reactions(fid)`,
  `CREATE INDEX IF NOT EXISTS reactions_emoji_idx ON reactions(board_id, emoji)`,

  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES moodboards(id),
    fid TEXT NOT NULL REFERENCES users(fid),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS comments_board_idx ON comments(board_id)`,
  `CREATE INDEX IF NOT EXISTS comments_fid_idx ON comments(fid)`,

  `CREATE TABLE IF NOT EXISTS remix_relationships (
    id TEXT PRIMARY KEY,
    remix_board_id TEXT NOT NULL REFERENCES moodboards(id),
    original_board_id TEXT NOT NULL REFERENCES moodboards(id),
    creator_fid TEXT REFERENCES users(fid),
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS remix_relationships_remix_idx ON remix_relationships(remix_board_id)`,
  `CREATE INDEX IF NOT EXISTS remix_relationships_original_idx ON remix_relationships(original_board_id)`,
  `CREATE INDEX IF NOT EXISTS remix_relationships_creator_idx ON remix_relationships(creator_fid)`,

  // === Create missing indexes on moodboards ===
  `CREATE INDEX IF NOT EXISTS moodboards_category_idx ON moodboards(fid, primary_category)`,
  `CREATE INDEX IF NOT EXISTS moodboards_updated_idx ON moodboards(fid, updated_at)`,
  `CREATE INDEX IF NOT EXISTS moodboards_public_views_idx ON moodboards(is_public, view_count)`,
  `CREATE INDEX IF NOT EXISTS moodboards_public_published_idx ON moodboards(is_public, published_at)`,
];

async function main() {
  console.log("🔧 Running schema alignment migration...\n");

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const sql of migrations) {
    const label = sql.trim().substring(0, 80).replace(/\s+/g, " ");
    try {
      await client.execute(sql);
      console.log(`  ✓ ${label}`);
      succeeded++;
    } catch (e) {
      const msg = e.message || String(e);
      // "duplicate column name" or "already exists" are expected if re-running
      if (
        msg.includes("duplicate column") ||
        msg.includes("already exists") ||
        msg.includes("duplicate")
      ) {
        console.log(`  ⊘ ${label}  (already exists, skipping)`);
        skipped++;
      } else {
        console.error(`  ✗ ${label}`);
        console.error(`    Error: ${msg}`);
        failed++;
      }
    }
  }

  console.log(
    `\n✅ Done: ${succeeded} applied, ${skipped} skipped, ${failed} failed`,
  );

  // Verify final state
  console.log("\n=== Verifying users table ===");
  const schema = await client.execute("PRAGMA table_info(users)");
  schema.rows.forEach((r) => console.log(`  ${r.name} (${r.type})`));

  console.log("\n=== Verifying moodboards has folder_id ===");
  const mbSchema = await client.execute("PRAGMA table_info(moodboards)");
  const folderCol = mbSchema.rows.find((r) => r.name === "folder_id");
  console.log(folderCol ? "  ✓ folder_id exists" : "  ✗ folder_id MISSING");

  // Test inserting a user with all columns
  console.log("\n=== Testing user insert with full schema ===");
  try {
    await client.execute({
      sql: `INSERT INTO users (fid, username, pfp_url, bio, social_links, follower_count, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fid) DO UPDATE SET updated_at = excluded.updated_at`,
      args: [
        "test-migration-check",
        "test",
        "",
        "",
        "{}",
        0,
        Date.now(),
        Date.now(),
      ],
    });
    console.log("  ✓ Full insert succeeded");
    // Clean up test row
    await client.execute({
      sql: "DELETE FROM users WHERE fid = ?",
      args: ["test-migration-check"],
    });
    console.log("  ✓ Cleanup done");
  } catch (e) {
    console.error("  ✗ Insert test failed:", e.message);
  }
}

main();
