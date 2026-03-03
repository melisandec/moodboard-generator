#!/usr/bin/env node

/**
 * Deployment test script for moodboard-generator API routes
 * Usage: node scripts/test-api.mjs [baseUrl] [token]
 *
 * Examples:
 *   npm run test:api http://localhost:3000
 *   npm run test:api https://moodboard-generator-phi.vercel.app <token>
 *
 * To get a token from Warpcast:
 *   1. Open the app in Warpcast
 *   2. DevTools → Console
 *   3. await sdk.quickAuth.getToken()
 */

import fetch from "node-fetch";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const TOKEN = process.argv[3];

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";

function log(level, message, data = "") {
  const timestamp = new Date().toISOString().split("T")[1];
  const colors = {
    error: RED,
    success: GREEN,
    warn: YELLOW,
    info: BLUE,
  };
  const color = colors[level] || RESET;
  console.log(
    `${color}[${timestamp}]${RESET} ${color}${level.toUpperCase()}${RESET} ${message}`,
    data,
  );
}

async function testApiRoute(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (TOKEN) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  try {
    log("info", `Testing ${method} ${path}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response
      .json()
      .catch(() => ({ raw: response.statusText }));

    if (response.ok) {
      log("success", `${method} ${path}`, JSON.stringify(data, null, 2));
      return { ok: true, data };
    } else {
      log(
        "error",
        `${method} ${path} returned ${response.status}`,
        JSON.stringify(data, null, 2),
      );
      return { ok: false, status: response.status, data };
    }
  } catch (err) {
    log("error", `${method} ${path} failed`, err.message);
    return { ok: false, error: err.message };
  }
}

async function runTests() {
  console.log(`\n${BLUE}========================================${RESET}`);
  console.log(`${BLUE}API Deployment Test Suite${RESET}`);
  console.log(`${BLUE}========================================${RESET}\n`);

  log("info", "Base URL:", BASE_URL);
  log(
    "info",
    "Auth Token:",
    TOKEN
      ? "✓ Present"
      : "⚠ Not provided (tests will fail if endpoints require auth)",
  );
  console.log();

  // Test 1: Health check (no auth required)
  log("info", "Test 1: Health check (GET /)");
  try {
    const res = await fetch(BASE_URL);
    log("success", `Status: ${res.status} OK\n`);
  } catch (err) {
    log("error", `Cannot reach ${BASE_URL}`, err.message);
    return;
  }

  if (!TOKEN) {
    log(
      "warn",
      "Skipping authenticated tests. To test /api/user and /api/boards/create:",
    );
    log("warn", "1. Open the app in Warpcast embedded browser");
    log("warn", "2. Run: await sdk.quickAuth.getToken()");
    log("warn", "3. Copy the token and run: npm run test:api <url> <token>\n");
    return;
  }

  // Test 2: POST /api/user
  log("info", "Test 2: User registration");
  const userResult = await testApiRoute("POST", "/api/user", {
    username: "test-user",
    pfpUrl: "https://example.com/pfp.jpg",
  });
  console.log();

  // Test 3: GET /api/user (if implemented)
  log("info", "Test 3: Get user (if available)");
  await testApiRoute("GET", "/api/user");
  console.log();

  // Test 4: POST /api/boards/create
  log("info", "Test 4: Create board");
  const boardResult = await testApiRoute("POST", "/api/boards/create", {
    title: "Test Board",
    caption: "Test caption",
    canvasState: [
      {
        id: "test-img-1",
        imageHash: "hash1",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        pinned: false,
        zIndex: 1,
        naturalWidth: 200,
        naturalHeight: 200,
      },
    ],
    canvasWidth: 400,
    canvasHeight: 400,
    background: "#FFFFFF",
    orientation: "square",
    margin: false,
    categories: ["test"],
    isPublic: false,
  });
  console.log();

  // Summary
  console.log(`${BLUE}========================================${RESET}`);
  console.log(`${BLUE}Test Summary${RESET}`);
  console.log(`${BLUE}========================================${RESET}\n`);

  if (userResult.ok) {
    log("success", "POST /api/user", "Working ✓");
  } else {
    log(
      "error",
      "POST /api/user",
      `Failed (${userResult.status || userResult.error})`,
    );
  }

  if (boardResult.ok) {
    log("success", "POST /api/boards/create", "Working ✓");
  } else {
    log(
      "error",
      "POST /api/boards/create",
      `Failed (${boardResult.status || boardResult.error})`,
    );
  }

  console.log();
  log("info", "For detailed server logs, check:");
  log("info", "Local: npm run dev and look in terminal output");
  log(
    "info",
    "Vercel: https://vercel.com/builders-apps/moodboard-generator/logs\n",
  );
}

runTests().catch((err) => {
  log("error", "Test suite failed:", err.message);
  process.exit(1);
});
