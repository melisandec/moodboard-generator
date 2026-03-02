-- Migration: add missing columns to moodboards table
ALTER TABLE moodboards ADD COLUMN remix_count INTEGER DEFAULT 0;
ALTER TABLE moodboards ADD COLUMN like_count INTEGER DEFAULT 0;
ALTER TABLE moodboards ADD COLUMN last_remix_at INTEGER;
ALTER TABLE moodboards ADD COLUMN preview_url TEXT;
ALTER TABLE moodboards ADD COLUMN published_at INTEGER;

-- Create missing tables for social features
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  fid TEXT NOT NULL,
  board_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (fid) REFERENCES users(fid),
  FOREIGN KEY (board_id) REFERENCES moodboards(id)
);
CREATE INDEX IF NOT EXISTS favorites_fid_idx ON favorites(fid);
CREATE INDEX IF NOT EXISTS favorites_board_idx ON favorites(board_id);
CREATE INDEX IF NOT EXISTS favorites_fid_board_idx ON favorites(fid, board_id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  fid TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (fid) REFERENCES users(fid)
);
CREATE INDEX IF NOT EXISTS collections_fid_idx ON collections(fid);
CREATE INDEX IF NOT EXISTS collections_public_idx ON collections(is_public);

CREATE TABLE IF NOT EXISTS collection_items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id),
  FOREIGN KEY (board_id) REFERENCES moodboards(id)
);
CREATE INDEX IF NOT EXISTS collection_items_collection_idx ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS collection_items_board_idx ON collection_items(board_id);

CREATE TABLE IF NOT EXISTS remix_relationships (
  id TEXT PRIMARY KEY,
  remix_of_id TEXT NOT NULL,
  remixed_board_id TEXT NOT NULL,
  fid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (remix_of_id) REFERENCES moodboards(id),
  FOREIGN KEY (remixed_board_id) REFERENCES moodboards(id),
  FOREIGN KEY (fid) REFERENCES users(fid)
);
CREATE INDEX IF NOT EXISTS remix_relationships_original_idx ON remix_relationships(remix_of_id);
CREATE INDEX IF NOT EXISTS remix_relationships_remix_idx ON remix_relationships(remixed_board_id);
CREATE INDEX IF NOT EXISTS remix_relationships_fid_idx ON remix_relationships(fid);
