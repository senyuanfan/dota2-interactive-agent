import type { DatabaseInstance } from '../index.js'

export function up(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      provider TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      UNIQUE(provider, entity_type, entity_key, patch_version)
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meta_snapshots_current
      ON meta_snapshots(is_current, patch_version);
    CREATE INDEX IF NOT EXISTS idx_meta_snapshots_lookup
      ON meta_snapshots(entity_type, entity_key);
  `)
}

export function down(db: DatabaseInstance): void {
  db.exec(`
    DROP TABLE IF EXISTS meta_snapshots;
  `)
}
