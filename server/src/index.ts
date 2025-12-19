import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import Database from 'better-sqlite3'
import { fetch } from 'undici'

type WebCitation = { title: string; url: string; snippet?: string }
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type NotesDb = InstanceType<typeof Database>

const PORT = Number(process.env.PORT ?? 8787)
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY ?? ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'
const SQLITE_PATH = resolveDbPath(process.env.SQLITE_PATH)
const db = initDb(SQLITE_PATH)

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : ''
  const history =
    Array.isArray(req.body?.history) && req.body.history.length
      ? (req.body.history as ChatMessage[])
      : []

  if (!message.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }
  if (!SERPAPI_API_KEY) {
    res.status(500).json({ error: 'SERPAPI_API_KEY is missing' })
    return
  }
  if (!OPENAI_API_KEY && !OPENROUTER_API_KEY) {
    res.status(500).json({ error: 'Provide OPENAI_API_KEY or OPENROUTER_API_KEY' })
    return
  }

  try {
    const serpResults = await searchSerpApi(message, SERPAPI_API_KEY)
    if (!serpResults.length) {
      res.status(502).json({ error: 'No search results from SerpAPI' })
      return
    }
    persistNotes(db, message, serpResults)

    const citations = serpResults.map((r) => ({ title: r.title, url: r.url }))
    const prompt = buildPrompt(message, serpResults)
    const sanitizedHistory: ChatMessage[] = history.map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content ?? '',
    }))

    const llmResponse = await callLLM({
      messages: [
        prompt.system,
        ...sanitizedHistory,
        prompt.user,
      ],
      useOpenRouterFallback: !OPENAI_API_KEY && !!OPENROUTER_API_KEY,
    })

    res.json({
      answer: llmResponse,
      citations,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to complete request' })
  }
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})

function buildPrompt(query: string, sources: WebCitation[]) {
  const numbered = sources
    .map(
      (s, idx) =>
        `[${idx + 1}] ${s.title}\n${s.snippet ?? ''}\nURL: ${s.url}`.trim(),
    )
    .join('\n\n')

  const system: ChatMessage = {
    role: 'system',
    content:
      'You are a concise Dota 2 assistant. Use the provided sources. Cite with [n]. Keep answers tight and practical.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Question: ${query}\n\nSources:\n${numbered}\n\nInstructions: Answer in 3-6 sentences. Use [n] citations. If unsure, say so briefly.`,
  }

  return { system, user }
}

async function searchSerpApi(
  query: string,
  apiKey: string,
  limit = 5,
): Promise<WebCitation[]> {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', apiKey)

  const resp = await fetch(url, { method: 'GET' })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`SerpAPI error ${resp.status}: ${text}`)
  }
  const json = (await resp.json()) as {
    organic_results?: Array<{
      title?: string
      link?: string
      snippet?: string
    }>
  }

  const items =
    json.organic_results?.map((r) => ({
      title: r.title ?? r.link ?? 'Untitled',
      url: r.link ?? '',
      snippet: r.snippet ?? '',
    })) ?? []

  return items.filter((r) => r.url).slice(0, limit)
}

async function callLLM({
  messages,
  useOpenRouterFallback,
}: {
  messages: ChatMessage[]
  useOpenRouterFallback: boolean
}): Promise<string> {
  const hasOpenAI = !!OPENAI_API_KEY
  const hasOpenRouter = !!OPENROUTER_API_KEY
  const useOpenAI = hasOpenAI && !useOpenRouterFallback
  const endpoint = useOpenAI
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions'

  const apiKey = useOpenAI ? OPENAI_API_KEY : OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('No API key available for selected provider')
  }
  const model = useOpenAI ? OPENAI_MODEL : OPENROUTER_MODEL

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...(useOpenAI
        ? {}
        : {
            'HTTP-Referer': 'http://localhost',
            'X-Title': 'dota2-interactive-agent',
          }),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`LLM request failed ${resp.status}: ${text}`)
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw new Error('Empty completion from LLM')
  }
  return content
}

function resolveDbPath(envPath?: string) {
  if (envPath) {
    return path.resolve(process.cwd(), envPath)
  }
  return path.resolve(process.cwd(), '..', 'data', 'notes.db')
}

function initDb(filePath: string) {
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

function persistNotes(dbHandle: NotesDb, query: string, sources: WebCitation[]) {
  const insert = dbHandle.prepare(
    `INSERT INTO notes (query, source_url, source_title, snippet, tags, summary)
     VALUES (@query, @source_url, @source_title, @snippet, @tags, @summary);`,
  )
  const tags = 'web,serpapi'
  for (const s of sources) {
    insert.run({
      query,
      source_url: s.url,
      source_title: s.title,
      snippet: s.snippet ?? '',
      tags,
      summary: null,
    })
  }
}