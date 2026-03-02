-- Migration: add activities table
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  board_id TEXT,
  fid TEXT,
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (board_id) REFERENCES moodboards(id),
  FOREIGN KEY (fid) REFERENCES users(fid)
);
CREATE INDEX IF NOT EXISTS activities_board_idx ON activities(board_id);
CREATE INDEX IF NOT EXISTS activities_fid_idx ON activities(fid);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(type);
