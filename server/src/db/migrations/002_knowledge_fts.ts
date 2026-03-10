import type { DatabaseInstance } from '../index.js'

export function up(db: DatabaseInstance): void {
  // FTS5 virtual table for full-text search over knowledge_base
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
      title,
      content,
      summary,
      tags,
      content='knowledge_base',
      content_rowid='id'
    );
  `)

  // Triggers to keep FTS index in sync with knowledge_base table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS kb_fts_ai AFTER INSERT ON knowledge_base BEGIN
      INSERT INTO knowledge_base_fts(rowid, title, content, summary, tags)
      VALUES (new.id, new.title, new.content, new.summary, new.tags);
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS kb_fts_ad AFTER DELETE ON knowledge_base BEGIN
      INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, title, content, summary, tags)
      VALUES ('delete', old.id, old.title, old.content, old.summary, old.tags);
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS kb_fts_au AFTER UPDATE ON knowledge_base BEGIN
      INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, title, content, summary, tags)
      VALUES ('delete', old.id, old.title, old.content, old.summary, old.tags);
      INSERT INTO knowledge_base_fts(rowid, title, content, summary, tags)
      VALUES (new.id, new.title, new.content, new.summary, new.tags);
    END;
  `)
}

export function down(db: DatabaseInstance): void {
  db.exec('DROP TRIGGER IF EXISTS kb_fts_au;')
  db.exec('DROP TRIGGER IF EXISTS kb_fts_ad;')
  db.exec('DROP TRIGGER IF EXISTS kb_fts_ai;')
  db.exec('DROP TABLE IF EXISTS knowledge_base_fts;')
}
