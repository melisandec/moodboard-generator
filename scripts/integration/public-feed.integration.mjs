import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.INTEGRATION_BASE_URL ?? "http://localhost:3000";

async function getFeed(limit = 12, offset = 0, sortBy = "newest") {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(
      `${BASE_URL}/api/boards/public?limit=${limit}&offset=${offset}&sortBy=${sortBy}`,
    );
    if (res.ok) return res.json();
    lastStatus = res.status;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  assert.fail(`Feed request failed with ${lastStatus}`);
}

async function getDetail(boardId) {
  const res = await fetch(`${BASE_URL}/api/boards/${boardId}/public`);
  assert.equal(res.ok, true, `Detail request failed with ${res.status}`);
  return res.json();
}

test("publish/feed path returns published + updated metadata", async (t) => {
  const feed = await getFeed(12, 0, "newest");
  assert.ok(Array.isArray(feed.boards));
  if (feed.boards.length === 0) {
    t.skip("No public boards available in current dataset");
    return;
  }

  const board = feed.boards[0];
  assert.ok(board.id);
  assert.ok(board.title);
  assert.ok(board.updatedAt, "Expected updatedAt in feed payload");
  assert.ok(
    board.publishedAt || board.createdAt,
    "Expected publishedAt or createdAt in feed payload",
  );
});

test("modal/detail path returns collage payload", async (t) => {
  const feed = await getFeed(12, 0, "newest");
  if (feed.boards.length === 0) {
    t.skip("No public boards available in current dataset");
    return;
  }
  const board = feed.boards[0];
  assert.ok(board?.id, "Expected board id in feed response");

  const detail = await getDetail(board.id);
  assert.equal(detail.id, board.id);
  assert.ok(Array.isArray(detail.canvasState), "Expected canvasState array");
  assert.ok(typeof detail.imageMap === "object", "Expected imageMap object");
  assert.ok(typeof detail.previewMissingCount === "number");
});

test("edit flow contract keeps board id stable across refresh", async (t) => {
  const first = await getFeed(12, 0, "newest");
  if (first.boards.length === 0) {
    t.skip("No public boards available in current dataset");
    return;
  }

  const targetId = first.boards[0].id;

  const second = await getFeed(12, 0, "newest");
  const same = second.boards.find((b) => b.id === targetId);
  assert.ok(same, "Expected same board id to remain addressable after refresh");
});

test("missing-image fallback contract surfaces missing asset counts", async (t) => {
  const feed = await getFeed(24, 0, "newest");
  const withMissing = feed.boards.find((b) => (b.previewMissingCount ?? 0) > 0);

  if (!withMissing) {
    t.skip("No board with missing assets available in current dataset");
    return;
  }

  const detail = await getDetail(withMissing.id);
  assert.ok(
    detail.previewMissingCount > 0,
    "Expected detail endpoint to report missing assets for the same board",
  );
});
