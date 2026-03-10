import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { WebCitation, KnowledgeEntry, IngestResult } from './types.js'

export type NotesDb = InstanceType<typeof Database>

export function resolveDbPath(envPath?: string) {
  if (envPath) {
    return path.resolve(process.cwd(), envPath)
  }
  return path.resolve(process.cwd(), '..', 'data', 'notes.db')
}

export function initDb(filePath: string): NotesDb {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const database = new Database(filePath)
  database.pragma('journal_mode = WAL')

  database.exec(
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      query TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT,
      snippet TEXT,
      tags TEXT,
      summary TEXT
    );`,
  )

  // FTS5 virtual table for full-text search over the knowledge base
  database.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      source_title,
      snippet,
      summary,
      tags,
      content='notes',
      content_rowid='id'
    );`,
  )

  // Triggers to keep FTS index in sync with notes table
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, source_title, snippet, summary, tags)
      VALUES (new.id, new.source_title, new.snippet, new.summary, new.tags);
    END;
  `)
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, source_title, snippet, summary, tags)
      VALUES ('delete', old.id, old.source_title, old.snippet, old.summary, old.tags);
    END;
  `)
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, source_title, snippet, summary, tags)
      VALUES ('delete', old.id, old.source_title, old.snippet, old.summary, old.tags);
      INSERT INTO notes_fts(rowid, source_title, snippet, summary, tags)
      VALUES (new.id, new.source_title, new.snippet, new.summary, new.tags);
    END;
  `)

  return database
}

export function persistNotes(dbHandle: NotesDb, query: string, sources: WebCitation[]) {
  const insert = dbHandle.prepare(
    `INSERT INTO notes (query, source_url, source_title, snippet, tags, summary)
     VALUES (@query, @source_url, @source_title, @snippet, @tags, @summary);`,
  )
  const insertAll = dbHandle.transaction((items: WebCitation[]) => {
    const tags = 'web,serpapi'
    for (const s of items) {
      insert.run({
        query,
        source_url: s.url,
        source_title: s.title,
        snippet: s.snippet ?? '',
        tags,
        summary: null,
      })
    }
  })
  insertAll(sources)
}

export function persistIngest(
  dbHandle: NotesDb,
  entry: { source_url: string; source_title: string; summary: string; tags: string },
): IngestResult {
  const stmt = dbHandle.prepare(
    `INSERT INTO notes (query, source_url, source_title, snippet, tags, summary)
     VALUES (@query, @source_url, @source_title, @snippet, @tags, @summary)`,
  )
  const info = stmt.run({
    query: '',
    source_url: entry.source_url,
    source_title: entry.source_title,
    snippet: '',
    tags: entry.tags,
    summary: entry.summary,
  })
  return {
    id: Number(info.lastInsertRowid),
    source_url: entry.source_url,
    source_title: entry.source_title,
    summary: entry.summary,
  }
}

export function searchKnowledge(
  dbHandle: NotesDb,
  query: string,
  limit = 5,
): KnowledgeEntry[] {
  // FTS5 query: escape double quotes in user input, use prefix matching
  const sanitized = query.replace(/"/g, '""')
  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(' OR ')

  if (!ftsQuery) return []

  const rows = dbHandle
    .prepare(
      `SELECT n.id, n.source_url, n.source_title, n.snippet, n.tags, n.summary,
              rank
       FROM notes_fts fts
       JOIN notes n ON n.id = fts.rowid
       WHERE notes_fts MATCH @query
       ORDER BY rank
       LIMIT @limit`,
    )
    .all({ query: ftsQuery, limit }) as KnowledgeEntry[]

  return rows
}
