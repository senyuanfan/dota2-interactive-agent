import path from 'node:path'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import type { ChatMessage, WebCitation } from './types.js'
import { resolveDbPath, initDb, persistNotes, persistIngest, searchKnowledge } from './db.js'
import { searchSerpApi } from './search.js'
import { buildPrompt, callLLM } from './llm.js'
import { digestYouTubeVideo } from './ingest/youtube.js'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

const PORT = Number(process.env.PORT ?? 8787)
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY ?? ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const SQLITE_PATH = resolveDbPath(process.env.SQLITE_PATH)
const db = initDb(SQLITE_PATH)

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// ── Chat endpoint ──────────────────────────────────────────────
// Pipeline: local KB first → web search supplement → LLM
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
  if (!OPENAI_API_KEY && !OPENROUTER_API_KEY) {
    res.status(500).json({ error: 'Provide OPENAI_API_KEY or OPENROUTER_API_KEY' })
    return
  }

  try {
    // 1. Search local knowledge base
    const kbResults = searchKnowledge(db, message, 5)
    const kbSources: WebCitation[] = kbResults.map((r) => ({
      title: r.source_title,
      url: r.source_url,
      snippet: r.summary || r.snippet,
    }))

    // 2. Supplement with web search if KB has fewer than 3 results
    let webSources: WebCitation[] = []
    if (kbSources.length < 3 && SERPAPI_API_KEY) {
      const serpResults = await searchSerpApi(message, SERPAPI_API_KEY, 5 - kbSources.length)
      webSources = serpResults
      if (serpResults.length) {
        persistNotes(db, message, serpResults)
      }
    }

    const allSources = [...kbSources, ...webSources]
    if (!allSources.length) {
      res.json({
        answer:
          'I could not find relevant sources for that query right now. Try rephrasing or adding more specifics.',
        citations: [],
        kbHits: 0,
      })
      return
    }

    const citations = allSources.map((r) => ({ title: r.title, url: r.url }))
    const prompt = buildPrompt(message, allSources)
    const sanitizedHistory: ChatMessage[] = history.map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content ?? '',
    }))

    const llmResponse = await callLLM({
      messages: [prompt.system, ...sanitizedHistory, prompt.user],
      openAiKey: OPENAI_API_KEY,
      openRouterKey: OPENROUTER_API_KEY,
      openAiModel: OPENAI_MODEL,
      openRouterModel: OPENROUTER_MODEL,
    })

    res.json({ answer: llmResponse, citations, kbHits: kbSources.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to complete request' })
  }
})

// ── Ingest endpoint ────────────────────────────────────────────
// Accepts a YouTube URL, uses Gemini to digest the video, stores in KB
app.post('/api/ingest', async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''

  if (!url) {
    res.status(400).json({ error: 'url is required' })
    return
  }
  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY is missing' })
    return
  }

  // Validate YouTube URL
  const ytPattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/
  if (!ytPattern.test(url)) {
    res.status(400).json({ error: 'Only YouTube URLs are supported' })
    return
  }

  try {
    const digest = await digestYouTubeVideo(url, GEMINI_API_KEY)
    const entry = persistIngest(db, {
      source_url: url,
      source_title: digest.title,
      summary: digest.summary,
      tags: 'youtube,video,gemini',
    })

    res.json({
      message: 'Video digested and stored in knowledge base',
      entry,
    })
  } catch (err) {
    console.error('Ingest failed:', err)
    res.status(500).json({ error: 'Failed to digest video' })
  }
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
