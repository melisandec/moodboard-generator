#!/usr/bin/env node
import { createClient } from '@libsql/client';

function nowId(prefix, id) {
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

async function run() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  // Ensure activities table exists (create if missing)
  await client.execute({ sql: `
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      board_id TEXT,
      fid TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );
  ` });

  // Fetch moodboards rows
  const res = await client.execute({ sql: 'SELECT id, fid, created_at, last_remix_at, edit_history FROM moodboards' });
  const rows = (res && Array.isArray(res.rows)) ? res.rows : [];
  let inserted = 0;

  for (const row of rows) {
    // Handle both array and object row formats
    let id, fid, created_at, last_remix_at, edit_history;
    if (Array.isArray(row)) {
      [id, fid, created_at, last_remix_at, edit_history] = row;
    } else if (typeof row === 'object') {
      ({ id, fid, created_at, last_remix_at, edit_history } = row);
    } else {
      continue;
    }

    // created
    if (created_at) {
      try {
        await client.execute({ sql: 'INSERT OR IGNORE INTO activities (id,type,board_id,fid,details,created_at) VALUES (?,?,?,?,?,?)', args: [nowId('act-created', id), 'created', id, fid, JSON.stringify({ createdAt: created_at }), typeof created_at === 'number' ? created_at : Date.parse(String(created_at))] });
        inserted++;
      } catch (e) {
        console.warn('created insert failed for', id, e.message || e);
      }
    }

    // remixed
    if (last_remix_at) {
      try {
        await client.execute({ sql: 'INSERT OR IGNORE INTO activities (id,type,board_id,fid,details,created_at) VALUES (?,?,?,?,?,?)', args: [nowId('act-remix', id), 'remixed', id, null, JSON.stringify({ lastRemixAt: last_remix_at }), typeof last_remix_at === 'number' ? last_remix_at : Date.parse(String(last_remix_at))] });
        inserted++;
      } catch (e) {
        console.warn('remix insert failed for', id, e.message || e);
      }
    }

    // edit history (assuming JSON array)
    if (edit_history) {
      try {
        let history = [];
        try { history = JSON.parse(edit_history); } catch (_) { history = edit_history || []; }
        for (const h of history) {
          const when = h.editedAt ? Date.parse(String(h.editedAt)) : Date.now();
          await client.execute({ sql: 'INSERT OR IGNORE INTO activities (id,type,board_id,fid,details,created_at) VALUES (?,?,?,?,?,?)', args: [nowId('act-edit', id), 'modified', id, h.fid || null, JSON.stringify({ username: h.username || null }), when] });
          inserted++;
        }
      } catch (e) {
        console.warn('editHistory insert failed for', id, e.message || e);
      }
    }
  }

  console.log('Backfill complete. Inserted activities:', inserted);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
