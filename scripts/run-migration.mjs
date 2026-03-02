#!/usr/bin/env node

import { execSync } from "child_process";

try {
  // Run drizzle-kit push with default option (create column)
  const result = execSync("cd /Users/melisandecornetlichtfus/Desktop/builders-apps/moodboard-generator && npx drizzle-kit push --config drizzle.config.ts", {
    stdio: "pipe",
    encoding: "utf-8",
  });
  
  console.log(result);
} catch (error) {
  // If it prompts, try to handle it
  console.log("Migration output:");
  console.log(error.message);
  console.log(error.stderr?.toString() || "");
}
