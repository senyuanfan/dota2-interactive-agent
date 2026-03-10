import { Router } from 'express'
import type { DatabaseInstance } from '../db/index.js'
import type { LLMService, ChatMessage } from '../services/llm.js'
import { searchWeb, type WebCitation } from '../services/search.js'
import { searchKnowledge, knowledgeToCitations } from '../services/knowledge.js'
import { getProfile, updateProfile, type UserProfile } from './profile.js'
import { extractPreferences, hasPreferences } from '../services/profile.js'
import { evolveProfile, buildPersonalizedPrompt, hasProfileData } from '../services/memory.js'

interface ChatRouterDeps {
  db: DatabaseInstance
  llm: LLMService
  serpApiKey: string
}

export function createChatRouter({ db, llm, serpApiKey }: ChatRouterDeps): Router {
  const router = Router()

  router.post('/', async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : ''
    const history =
      Array.isArray(req.body?.history) && req.body.history.length
        ? (req.body.history as ChatMessage[])
        : []

    if (!message.trim()) {
      res.status(400).json({ error: 'message is required' })
      return
    }

    try {
      // Load user profile
      const profile = getProfile(db)

      // Extract preferences from user message (async, non-blocking)
      extractAndUpdateProfile(db, llm, message, profile).catch((err) => {
        console.error('Background profile update failed:', err)
      })

      // 1. Search local knowledge base first
      const kbResults = searchKnowledge(db, message, 5)
      const kbSources = knowledgeToCitations(kbResults)

      // 2. Supplement with web search if KB has fewer than 3 results
      let webSources: WebCitation[] = []
      if (kbSources.length < 3 && serpApiKey) {
        const serpResults = await searchWeb(message, serpApiKey, { limit: 5 - kbSources.length })
        webSources = serpResults
        if (serpResults.length) {
          try {
            persistNotes(db, message, serpResults)
          } catch (err) {
            console.error('Failed to persist notes:', err)
          }
        }
      }

      // 3. Merge sources, dedup by URL
      const seen = new Set<string>()
      const allSources: WebCitation[] = []
      for (const s of [...kbSources, ...webSources]) {
        if (s.url && !seen.has(s.url)) {
          seen.add(s.url)
          allSources.push(s)
        }
      }

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
      const { systemMessage, userMessage } = buildPrompt(message, allSources, profile)

      const sanitizedHistory: ChatMessage[] = history.map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content ?? '',
      }))

      const response = await llm.chat(
        [systemMessage, ...sanitizedHistory, userMessage],
        { temperature: 0.2, maxTokens: 400 }
      )

      res.json({
        answer: response.content,
        citations,
        kbHits: kbSources.length,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to complete request' })
    }
  })

  return router
}

function buildPrompt(
  query: string,
  sources: WebCitation[],
  profile: UserProfile | null
): { systemMessage: ChatMessage; userMessage: ChatMessage } {
  const numbered = sources
    .map(
      (s, idx) =>
        `[${idx + 1}] ${s.title}\n${s.snippet ?? ''}\nURL: ${s.url}`.trim()
    )
    .join('\n\n')

  // Use personalized prompt if profile has data, otherwise use default
  const systemContent =
    profile && hasProfileData(profile)
      ? buildPersonalizedPrompt(profile)
      : 'You are a concise Dota 2 assistant. Use the provided sources. Cite with [n]. Keep answers tight and practical.'

  const systemMessage: ChatMessage = {
    role: 'system',
    content: systemContent,
  }

  const userMessage: ChatMessage = {
    role: 'user',
    content: `Question: ${query}\n\nSources:\n${numbered}\n\nInstructions: Answer in 3-6 sentences. Use [n] citations. If unsure, say so briefly.`,
  }

  return { systemMessage, userMessage }
}

/**
 * Extract preferences from message and update profile (runs in background)
 */
async function extractAndUpdateProfile(
  db: DatabaseInstance,
  llm: LLMService,
  message: string,
  profile: UserProfile | null
): Promise<void> {
  if (!profile) return

  const extracted = await extractPreferences(message, llm)

  if (!hasPreferences(extracted)) return

  const { updated, changes } = evolveProfile(profile, extracted)

  if (changes.length > 0) {
    console.log('Profile evolution:', changes.map((c) => `${c.field}: ${c.action}`).join(', '))
    updateProfile(db, updated)
  }
}

function persistNotes(
  db: DatabaseInstance,
  query: string,
  sources: WebCitation[]
): void {
  const insert = db.prepare(
    `INSERT INTO notes (query, source_url, source_title, snippet, tags, summary)
     VALUES (@query, @source_url, @source_title, @snippet, @tags, @summary);`
  )

  const insertAll = db.transaction((items: WebCitation[]) => {
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
