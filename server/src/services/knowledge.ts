import type { DatabaseInstance } from '../db/index.js'
import type { WebCitation } from './search.js'

export interface KnowledgeEntry {
  id: number
  source_url: string
  source_type: string
  title: string
  content: string
  summary: string | null
  tags: string
  related_heroes: string
  related_topics: string
}

export interface KnowledgeSearchResult {
  id: number
  title: string
  url: string
  snippet: string
  source_type: string
}

/**
 * Search the local knowledge base using FTS5 full-text search
 */
export function searchKnowledge(
  db: DatabaseInstance,
  query: string,
  limit = 5
): KnowledgeSearchResult[] {
  const sanitized = query.replace(/"/g, '""')
  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(' OR ')

  if (!ftsQuery) return []

  const rows = db
    .prepare(
      `SELECT kb.id, kb.title, kb.source_url, kb.summary, kb.content, kb.source_type
       FROM knowledge_base_fts fts
       JOIN knowledge_base kb ON kb.id = fts.rowid
       WHERE knowledge_base_fts MATCH @query
       ORDER BY rank
       LIMIT @limit`
    )
    .all({ query: ftsQuery, limit }) as Array<{
      id: number
      title: string
      source_url: string
      summary: string | null
      content: string
      source_type: string
    }>

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.source_url || '',
    snippet: r.summary || r.content.slice(0, 300),
    source_type: r.source_type,
  }))
}

/**
 * Convert knowledge search results to WebCitation format for the chat pipeline
 */
export function knowledgeToCitations(results: KnowledgeSearchResult[]): WebCitation[] {
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
  }))
}

/**
 * Persist a new entry into the knowledge base
 */
export function persistKnowledgeEntry(
  db: DatabaseInstance,
  entry: {
    source_url: string
    source_type: string
    title: string
    content: string
    summary?: string
    tags?: string[]
    related_heroes?: string[]
    related_topics?: string[]
  }
): { id: number } {
  const stmt = db.prepare(
    `INSERT INTO knowledge_base (source_url, source_type, title, content, summary, tags, related_heroes, related_topics)
     VALUES (@source_url, @source_type, @title, @content, @summary, @tags, @related_heroes, @related_topics)`
  )
  const info = stmt.run({
    source_url: entry.source_url,
    source_type: entry.source_type,
    title: entry.title,
    content: entry.content,
    summary: entry.summary ?? null,
    tags: JSON.stringify(entry.tags ?? []),
    related_heroes: JSON.stringify(entry.related_heroes ?? []),
    related_topics: JSON.stringify(entry.related_topics ?? []),
  })
  return { id: Number(info.lastInsertRowid) }
}
