import type { DatabaseInstance } from '../db/index.js'
import { fetchOpenDotaSnapshot } from './opendota.js'
import { fetchStratzPublicSnapshot } from './stratz.js'

type MetaProvider = 'opendota' | 'stratz'
type MetaEntityType = 'hero'

interface MetaSnapshotRow {
  provider: MetaProvider
  entity_type: MetaEntityType
  entity_key: string
  patch_version: string
  data_json: string
}

export interface MetaEntry {
  provider: MetaProvider
  entityType: MetaEntityType
  entityKey: string
  patchVersion: string
  data: Record<string, unknown>
  fetchedAt: string
}

export interface SyncMetaResult {
  patchVersion: string
  fetchedAt: string
  opendotaCount: number
  stratzCount: number
  stratzPublicAvailable: boolean
  storedCount: number
}

export interface MetaContextSource {
  title: string
  url: string
  snippet: string
}

export async function syncMetaData(
  db: DatabaseInstance,
  options: { opendotaApiKey?: string } = {}
): Promise<SyncMetaResult> {
  const fetchedAt = new Date().toISOString()
  const opendota = await fetchOpenDotaSnapshot(options.opendotaApiKey)
  const stratz = await fetchStratzPublicSnapshot()

  const entries: MetaEntry[] = [
    ...opendota.heroes.map((hero) => ({
      provider: 'opendota' as const,
      entityType: 'hero' as const,
      entityKey: String(hero.id),
      patchVersion: opendota.patchVersion,
      fetchedAt,
      data: {
        heroId: hero.id,
        heroName: hero.localized_name ?? `Hero ${hero.id}`,
        proPick: hero.pro_pick ?? 0,
        proBan: hero.pro_ban ?? 0,
        proWin: hero.pro_win ?? 0,
        turboPicks: hero.turbo_picks ?? 0,
        turboWins: hero.turbo_wins ?? 0,
      },
    })),
    ...stratz.heroes.map((hero) => ({
      provider: 'stratz' as const,
      entityType: 'hero' as const,
      entityKey: String(hero.id),
      patchVersion: opendota.patchVersion,
      fetchedAt,
      data: {
        heroId: hero.id,
        heroName: hero.name,
      },
    })),
  ]

  const storedCount = persistMetaEntries(db, opendota.patchVersion, entries)
  upsertCurrentPatch(db, opendota.patchVersion)

  return {
    patchVersion: opendota.patchVersion,
    fetchedAt,
    opendotaCount: opendota.heroes.length,
    stratzCount: stratz.heroes.length,
    stratzPublicAvailable: stratz.sourceAvailable,
    storedCount,
  }
}

export function getCurrentMeta(
  db: DatabaseInstance,
  options: { limit?: number; provider?: MetaProvider; entityType?: MetaEntityType } = {}
): MetaEntry[] {
  const limit = Math.max(1, Math.min(500, options.limit ?? 100))

  const clauses: string[] = ['is_current = 1']
  const params: Record<string, unknown> = { limit }

  if (options.provider) {
    clauses.push('provider = @provider')
    params.provider = options.provider
  }

  if (options.entityType) {
    clauses.push('entity_type = @entity_type')
    params.entity_type = options.entityType
  }

  const sql = `
    SELECT provider, entity_type, entity_key, patch_version, data_json
    FROM meta_snapshots
    WHERE ${clauses.join(' AND ')}
    ORDER BY provider ASC, entity_type ASC, entity_key ASC
    LIMIT @limit
  `

  const rows = db.prepare(sql).all(params) as MetaSnapshotRow[]
  return rows.map((row) => ({
    provider: row.provider,
    entityType: row.entity_type,
    entityKey: row.entity_key,
    patchVersion: row.patch_version,
    data: safeJsonParse(row.data_json),
    fetchedAt: '',
  }))
}

export function getRelevantCurrentMetaSources(
  db: DatabaseInstance,
  query: string,
  limit: number = 3
): MetaContextSource[] {
  const rows = db
    .prepare(
      `
      SELECT provider, entity_type, entity_key, patch_version, data_json
      FROM meta_snapshots
      WHERE is_current = 1 AND entity_type = 'hero'
      LIMIT 300
      `
    )
    .all() as MetaSnapshotRow[]

  const normalizedQuery = query.toLowerCase()
  const matched = rows
    .map((row) => {
      const data = safeJsonParse(row.data_json)
      const heroName = typeof data.heroName === 'string' ? data.heroName : `Hero ${row.entity_key}`
      return { row, data, heroName }
    })
    .filter((entry) => normalizedQuery.includes(entry.heroName.toLowerCase()))
    .slice(0, Math.max(1, limit))

  return matched.map(({ row, data, heroName }) => ({
    title: `${heroName} (${row.provider}, patch ${row.patch_version})`,
    url:
      row.provider === 'opendota'
        ? `https://www.opendota.com/heroes/${row.entity_key}`
        : `https://stratz.com/heroes/${row.entity_key}`,
    snippet: buildHeroSnippet(data),
  }))
}

function buildHeroSnippet(data: Record<string, unknown>): string {
  const hasOpenDotaMetrics =
    typeof data.proPick === 'number' ||
    typeof data.proBan === 'number' ||
    typeof data.proWin === 'number'

  if (!hasOpenDotaMetrics) {
    return 'Public hero reference entry.'
  }

  const proPick = typeof data.proPick === 'number' ? data.proPick : 0
  const proBan = typeof data.proBan === 'number' ? data.proBan : 0
  const proWin = typeof data.proWin === 'number' ? data.proWin : 0
  return `Pro picks: ${proPick}, bans: ${proBan}, wins: ${proWin}.`
}

function persistMetaEntries(
  db: DatabaseInstance,
  patchVersion: string,
  entries: MetaEntry[]
): number {
  if (!entries.length) return 0

  const markStaleStmt = db.prepare('UPDATE meta_snapshots SET is_current = 0')
  const upsertStmt = db.prepare(`
    INSERT INTO meta_snapshots (
      provider, entity_type, entity_key, patch_version, data_json, fetched_at, is_current, updated_at
    )
    VALUES (
      @provider, @entity_type, @entity_key, @patch_version, @data_json, @fetched_at, 1, datetime('now')
    )
    ON CONFLICT(provider, entity_type, entity_key, patch_version)
    DO UPDATE SET
      data_json = excluded.data_json,
      fetched_at = excluded.fetched_at,
      is_current = 1,
      updated_at = datetime('now')
  `)

  const tx = db.transaction((payload: MetaEntry[]) => {
    markStaleStmt.run()
    for (const entry of payload) {
      upsertStmt.run({
        provider: entry.provider,
        entity_type: entry.entityType,
        entity_key: entry.entityKey,
        patch_version: patchVersion,
        data_json: JSON.stringify(entry.data),
        fetched_at: entry.fetchedAt,
      })
    }
  })

  tx(entries)
  return entries.length
}

function upsertCurrentPatch(db: DatabaseInstance, patchVersion: string): void {
  const tx = db.transaction(() => {
    db.prepare('UPDATE patch_info SET is_current = 0').run()
    db.prepare(`
      INSERT INTO patch_info (patch_version, is_current, release_date)
      VALUES (@patch_version, 1, datetime('now'))
      ON CONFLICT(patch_version)
      DO UPDATE SET is_current = 1
    `).run({ patch_version: patchVersion })
  })

  tx()
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}
