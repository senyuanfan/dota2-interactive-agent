import type { DatabaseInstance } from '../db/index.js'
import { persistKnowledgeEntry } from './knowledge.js'
import { fetchOpenDotaSnapshot, type OpenDotaHeroStat } from './opendota.js'
import { fetchStratzPublicSnapshot } from './stratz.js'

export interface SyncMetaResult {
  patchVersion: string
  fetchedAt: string
  opendotaCount: number
  stratzCount: number
  stratzAvailable: boolean
  storedCount: number
}

/**
 * Fetch hero data from OpenDota and Stratz, then ingest into the knowledge base.
 * Old entries for the same source_type are deleted before inserting fresh data.
 */
export async function syncMetaData(
  db: DatabaseInstance,
  options: { opendotaApiKey?: string } = {}
): Promise<SyncMetaResult> {
  const fetchedAt = new Date().toISOString()

  const [opendota, stratz] = await Promise.all([
    fetchOpenDotaSnapshot(options.opendotaApiKey),
    fetchStratzPublicSnapshot(),
  ])

  const patchVersion = opendota.patchVersion

  // Remove stale meta entries before inserting fresh ones
  const deleteTx = db.transaction(() => {
    db.prepare(`DELETE FROM knowledge_base WHERE source_type = 'opendota'`).run()
    db.prepare(`DELETE FROM knowledge_base WHERE source_type = 'stratz'`).run()
  })
  deleteTx()

  // Update patch_info
  const patchTx = db.transaction(() => {
    db.prepare('UPDATE patch_info SET is_current = 0').run()
    db.prepare(`
      INSERT INTO patch_info (patch_version, is_current, release_date)
      VALUES (@patch_version, 1, datetime('now'))
      ON CONFLICT(patch_version)
      DO UPDATE SET is_current = 1
    `).run({ patch_version: patchVersion })
  })
  patchTx()

  // Ingest OpenDota hero stats
  let storedCount = 0

  const insertTx = db.transaction(() => {
    for (const hero of opendota.heroes) {
      persistKnowledgeEntry(db, {
        source_url: `https://www.opendota.com/heroes/${hero.id}`,
        source_type: 'opendota',
        title: `${hero.localized_name ?? `Hero ${hero.id}`} - Pro Stats (Patch ${patchVersion})`,
        content: buildOpenDotaContent(hero, patchVersion),
        summary: buildOpenDotaSummary(hero),
        tags: ['meta', 'hero-stats', `patch-${patchVersion}`],
        related_heroes: [hero.localized_name ?? `Hero ${hero.id}`],
        related_topics: ['meta', 'pro-scene', 'hero-stats'],
        patch_version: patchVersion,
      })
      storedCount++
    }

    // Ingest Stratz hero list
    for (const hero of stratz.heroes) {
      persistKnowledgeEntry(db, {
        source_url: `https://stratz.com/heroes/${hero.id}`,
        source_type: 'stratz',
        title: `${hero.name} - Stratz Reference (Patch ${patchVersion})`,
        content: `Hero reference entry for ${hero.name} (ID: ${hero.id}) from Stratz.`,
        summary: `Stratz hero reference: ${hero.name}.`,
        tags: ['meta', 'hero-reference', `patch-${patchVersion}`],
        related_heroes: [hero.name],
        related_topics: ['meta', 'hero-reference'],
        patch_version: patchVersion,
      })
      storedCount++
    }
  })
  insertTx()

  return {
    patchVersion,
    fetchedAt,
    opendotaCount: opendota.heroes.length,
    stratzCount: stratz.heroes.length,
    stratzAvailable: stratz.sourceAvailable,
    storedCount,
  }
}

function buildOpenDotaContent(hero: OpenDotaHeroStat, patchVersion: string): string {
  const name = hero.localized_name ?? `Hero ${hero.id}`
  const lines = [
    `${name} - Professional and public statistics (Patch ${patchVersion})`,
    `Pro picks: ${hero.pro_pick ?? 0}`,
    `Pro bans: ${hero.pro_ban ?? 0}`,
    `Pro wins: ${hero.pro_win ?? 0}`,
  ]

  const proPick = hero.pro_pick ?? 0
  const proWin = hero.pro_win ?? 0
  if (proPick > 0) {
    lines.push(`Pro win rate: ${((proWin / proPick) * 100).toFixed(1)}%`)
  }

  if (hero.turbo_picks) {
    lines.push(`Turbo picks: ${hero.turbo_picks}`)
    if (hero.turbo_wins) {
      lines.push(`Turbo win rate: ${((hero.turbo_wins / hero.turbo_picks) * 100).toFixed(1)}%`)
    }
  }

  return lines.join('\n')
}

function buildOpenDotaSummary(hero: OpenDotaHeroStat): string {
  const name = hero.localized_name ?? `Hero ${hero.id}`
  const proPick = hero.pro_pick ?? 0
  const proBan = hero.pro_ban ?? 0
  const proWin = hero.pro_win ?? 0
  return `${name}: ${proPick} pro picks, ${proBan} bans, ${proWin} wins.`
}
