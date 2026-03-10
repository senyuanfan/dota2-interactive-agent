import { fetch } from 'undici'

export interface OpenDotaHeroStat {
  id: number
  localized_name?: string
  pro_pick?: number
  pro_ban?: number
  pro_win?: number
  turbo_picks?: number
  turbo_wins?: number
}

export interface OpenDotaSnapshot {
  patchVersion: string
  heroes: OpenDotaHeroStat[]
}

function parsePatchVersion(payload: unknown): string {
  if (Array.isArray(payload) && payload.length > 0) {
    const last = payload[payload.length - 1] as Record<string, unknown>
    const named = last.name
    if (typeof named === 'string' && named.trim()) {
      return named.trim()
    }
    if (typeof last.id === 'number') {
      return String(last.id)
    }
  }
  return 'unknown'
}

export async function fetchOpenDotaSnapshot(apiKey?: string): Promise<OpenDotaSnapshot> {
  const patchUrl = new URL('https://api.opendota.com/api/constants/patch')
  if (apiKey) {
    patchUrl.searchParams.set('api_key', apiKey)
  }

  const patchResp = await fetch(patchUrl, { method: 'GET' })
  if (!patchResp.ok) {
    throw new Error(`OpenDota patch request failed (${patchResp.status})`)
  }
  const patchPayload = (await patchResp.json()) as unknown
  const patchVersion = parsePatchVersion(patchPayload)

  const heroUrl = new URL('https://api.opendota.com/api/heroStats')
  if (apiKey) {
    heroUrl.searchParams.set('api_key', apiKey)
  }

  const heroResp = await fetch(heroUrl, { method: 'GET' })
  if (!heroResp.ok) {
    throw new Error(`OpenDota hero stats request failed (${heroResp.status})`)
  }

  const heroes = (await heroResp.json()) as OpenDotaHeroStat[]
  return { patchVersion, heroes: Array.isArray(heroes) ? heroes : [] }
}
