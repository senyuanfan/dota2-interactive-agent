import path from 'node:path'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import type { ChatMessage } from './types.js'
import { resolveDbPath, initDb, persistNotes } from './db.js'
import { searchSerpApi } from './search.js'
import { buildPrompt, callLLM } from './llm.js'

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

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
      res.json({
        answer:
          'I could not find relevant sources for that query right now. Try rephrasing or adding more specifics.',
        citations: [],
      })
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
      messages: [prompt.system, ...sanitizedHistory, prompt.user],
      openAiKey: OPENAI_API_KEY,
      openRouterKey: OPENROUTER_API_KEY,
      openAiModel: OPENAI_MODEL,
      openRouterModel: OPENROUTER_MODEL,
    })

    res.json({ answer: llmResponse, citations })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to complete request' })
  }
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
