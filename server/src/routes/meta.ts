import { Router } from 'express'
import type { DatabaseInstance } from '../db/index.js'
import { syncMetaData } from '../services/meta.js'

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
    } catch (err) {
      console.error('Meta sync failed:', err)
      res.status(500).json({ error: 'Failed to sync meta data' })
    }
  })

  return router
}
