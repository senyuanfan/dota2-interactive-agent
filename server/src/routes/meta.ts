import { Router } from 'express'
import type { DatabaseInstance } from '../db/index.js'
import { getCurrentMeta, syncMetaData } from '../services/meta.js'

interface MetaRouterDeps {
  db: DatabaseInstance
  opendotaApiKey?: string
}

export function createMetaRouter({ db, opendotaApiKey }: MetaRouterDeps): Router {
  const router = Router()

  router.post('/sync', async (_req, res) => {
    try {
      const result = await syncMetaData(db, { opendotaApiKey })
      res.json(result)
    } catch {
      res.status(500).json({ error: 'Failed to sync meta data' })
    }
  })

  router.get('/current', (req, res) => {
    const limitRaw = Number(req.query.limit ?? 100)
    const limit = Number.isFinite(limitRaw) ? limitRaw : 100

    const provider =
      req.query.provider === 'opendota' || req.query.provider === 'stratz'
        ? req.query.provider
        : undefined

    const entityType = req.query.entityType === 'hero' ? 'hero' : undefined

    const items = getCurrentMeta(db, {
      limit,
      provider,
      entityType,
    })

    res.json({ items, count: items.length })
  })

  return router
}
