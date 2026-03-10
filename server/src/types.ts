export type WebCitation = { title: string; url: string; snippet?: string }
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type KnowledgeEntry = {
  id: number
  source_url: string
  source_title: string
  snippet: string
  tags: string
  summary: string | null
  rank?: number
}

export type IngestResult = {
  id: number
  source_url: string
  source_title: string
  summary: string
}
