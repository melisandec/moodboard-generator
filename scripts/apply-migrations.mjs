#!/usr/bin/env node
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables from .env and .env.local
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  const cwd = process.cwd();

  for (const file of envFiles) {
    try {
      const path = resolve(cwd, file);
      const content = readFileSync(path, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          const value = valueParts.join("=");
          if (key && value) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    } catch (e) {
      // File might not exist, continue to next
    }
  }
}

loadEnv();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const migrations = [
  // Add missing columns to moodboards
  `ALTER TABLE moodboards ADD COLUMN remix_count INTEGER DEFAULT 0`,
  `ALTER TABLE moodboards ADD COLUMN like_count INTEGER DEFAULT 0`,
  `ALTER TABLE moodboards ADD COLUMN last_remix_at INTEGER`,
  `ALTER TABLE moodboards ADD COLUMN preview_url TEXT`,
  `ALTER TABLE moodboards ADD COLUMN published_at INTEGER`,
  `ALTER TABLE moodboards ADD COLUMN primary_category TEXT DEFAULT 'Uncategorized'`,
  `ALTER TABLE moodboards ADD COLUMN sync_version INTEGER DEFAULT 1`,
];

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    for (const migration of migrations) {
      try {
        console.log(`Executing: ${migration.substring(0, 60)}...`);
        await client.execute(migration);
        console.log("  ✓ Success");
      } catch (error) {
        // Column already exists errors are safe to ignore
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes("already exists")) {
          console.log("  ⓘ Column already exists (skipped)");
        } else {
          console.error("  ✗ Error:", errorMsg);
          // Don't throw - continue with other migrations
        }
      }
    }

    console.log("\n✓ Database migrations complete");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

runMigrations();
