import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import * as migrations from './migrations/index.js'

export type DatabaseInstance = InstanceType<typeof Database>

/**
 * Initialize the database with migrations support
 */
export function initDatabase(dbPath: string): DatabaseInstance {
  // Ensure the directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Run pending migrations
  runMigrations(db)

  return db
}

/**
 * Run all pending migrations in order
 */
function runMigrations(db: DatabaseInstance): void {
  // Get applied migrations
  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => (row as { name: string }).name)
  )

  // Run pending migrations from the index
  for (const [name, migration] of Object.entries(migrations.allMigrations)) {
    if (applied.has(name)) {
      continue
    }

    console.log(`Running migration: ${name}`)

    // Run migration in a transaction
    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name)
    })()

    console.log(`Migration applied: ${name}`)
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(db: DatabaseInstance): void {
  db.close()
}
