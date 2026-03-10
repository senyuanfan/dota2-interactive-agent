import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { WebCitation } from './types.js'

type NotesDb = InstanceType<typeof Database>

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
