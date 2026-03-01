import fs from 'fs';
import { createClient } from '@libsql/client';

function loadEnvFile(filePath) {
  const envText = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of envText.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  'ALTER TABLE moodboards ADD COLUMN published_at INTEGER',
  'CREATE INDEX moodboards_public_published_idx ON moodboards (is_public, published_at)',
];

for (const statement of statements) {
  try {
    await client.execute(statement);
    console.log('OK', statement);
  } catch (error) {
    const msg = String(error?.message || error);
    if (/duplicate column name|already exists/i.test(msg)) {
      console.log('SKIP', statement);
    } else {
      console.error('FAIL', statement);
      console.error(msg);
      process.exitCode = 1;
    }
  }
}

const info = await client.execute('PRAGMA table_info(moodboards)');
console.log('COLUMNS', info.rows.map((r) => r.name).join(', '));
