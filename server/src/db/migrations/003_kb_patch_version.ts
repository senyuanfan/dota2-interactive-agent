import type { DatabaseInstance } from '../index.js'

export function up(db: DatabaseInstance): void {
  db.exec(`ALTER TABLE knowledge_base ADD COLUMN patch_version TEXT;`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_base_patch ON knowledge_base(patch_version);`)
}

export function down(db: DatabaseInstance): void {
  db.exec(`DROP INDEX IF EXISTS idx_knowledge_base_patch;`)
  // SQLite doesn't support DROP COLUMN before 3.35.0; leave column in place.
}
