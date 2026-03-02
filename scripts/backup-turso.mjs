#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

async function dumpTable(tableName) {
  try {
    const json = execSync(`turso db shell moodboard-db "SELECT json_group_array(json_object(*)) FROM ${tableName}"`, { encoding: 'utf8' })
    const match = json.match(/\[\[.*\]\]/s) || json.match(/(\[.*\])/s)
    if (match) {
      return JSON.parse(match[1])
    }
    return []
  } catch (err) {
    console.error(`  ✗ Error:`, err.message.split('\n')[0])
    return null
  }
}

async function listTables() {
  try {
    const output = execSync(`turso db shell moodboard-db "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"`, { encoding: 'utf8' })
    return output
      .trim()
      .split('\n')
      .filter((line, idx) => line && idx > 0 && line !== 'NAME')
      .map(line => line.trim())
  } catch (err) {
    console.error('Error listing tables:', err.message.split('\n')[0])
    return []
  }
}

async function dump() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.resolve(process.cwd(), `backups/backup-${ts}`)
  await fs.mkdir(outDir, { recursive: true })

  console.log('Listing tables...')
  const tables = await listTables()
  console.log(`Found ${tables.length} table(s)\n`)
  if (!tables.length) {
    console.warn('No tables found')
    return
  }

  const summary = { createdAt: new Date().toISOString(), dbName: 'moodboard-db', tables: {} }

  for (const t of tables) {
    console.log(`Dumping: ${t}`)
    const rows = await dumpTable(t)
    if (rows !== null) {
      const file = path.join(outDir, `${t}.json`)
      await fs.writeFile(file, JSON.stringify(rows, null, 2), 'utf8')
      summary.tables[t] = { rows: rows.length, file: `${t}.json` }
      console.log(`  ✓ ${rows.length} rows saved\n`)
    } else {
      summary.tables[t] = { error: 'Failed to dump' }
    }
  }

  await fs.writeFile(path.join(outDir, 'metadata.json'), JSON.stringify(summary, null, 2), 'utf8')
  console.log('✓ Backup complete:', outDir)
  console.log('\nTables backed up:')
  Object.entries(summary.tables).forEach(([t, info]) => {
    if (info.rows !== undefined) console.log(`  - ${t}: ${info.rows} rows`)
  })
}

dump().catch(err => { console.error('Backup failed:', err.message); process.exit(1) })
