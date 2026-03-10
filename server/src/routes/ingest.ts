import { Router } from 'express'
import type { DatabaseInstance } from '../db/index.js'
import { digestYouTubeVideo } from '../services/youtube.js'
import { persistKnowledgeEntry } from '../services/knowledge.js'

interface IngestRouterDeps {
  db: DatabaseInstance
  geminiApiKey: string
}

const YT_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/

export function createIngestRouter({ db, geminiApiKey }: IngestRouterDeps): Router {
  const router = Router()

  router.post('/', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''

    if (!url) {
      res.status(400).json({ error: 'url is required' })
      return
    }
    if (!geminiApiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is missing' })
      return
    }
    if (!YT_URL_PATTERN.test(url)) {
      res.status(400).json({ error: 'Only YouTube URLs are supported' })
      return
    }

    try {
      const digest = await digestYouTubeVideo(url, geminiApiKey)
      const { id } = persistKnowledgeEntry(db, {
        source_url: url,
        source_type: 'youtube',
        title: digest.title,
        content: digest.summary,
        summary: digest.summary,
        tags: ['youtube', 'video', 'gemini'],
      })

      res.json({
        message: 'Video digested and stored in knowledge base',
        entry: { id, source_url: url, title: digest.title, summary: digest.summary },
      })
    } catch (err) {
      console.error('Ingest failed:', err)
      res.status(500).json({ error: 'Failed to digest video' })
    }
  })

  return router
}
