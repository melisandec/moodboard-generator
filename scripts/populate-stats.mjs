#!/usr/bin/env node
import { execSync } from 'child_process'

console.log('Creating user_stats table...')
try {
  execSync(`turso db shell moodboard-db "CREATE TABLE IF NOT EXISTS user_stats (
    fid TEXT PRIMARY KEY, 
    total_boards_published INTEGER DEFAULT 0, 
    total_views INTEGER DEFAULT 0, 
    total_remixes INTEGER DEFAULT 0, 
    created_at INTEGER, 
    updated_at INTEGER
  );"`)
} catch (e) {
  console.warn('Create table output:', e.message)
}

console.log('Inserting stats...')
// Insert for FID 429450 (from moodboards)
execSync(`turso db shell moodboard-db "INSERT OR REPLACE INTO user_stats (fid, total_boards_published, total_views, total_remixes, created_at, updated_at) VALUES ('429450', 14, 10, 5, ${Date.now()}, ${Date.now()});"`)

console.log('✓ Stats table ready')
console.log('Verifying...')
const verify = execSync(`turso db shell moodboard-db "SELECT fid, total_boards_published, total_views, total_remixes FROM user_stats WHERE fid='429450';"`, { encoding: 'utf8' })
console.log(verify)
