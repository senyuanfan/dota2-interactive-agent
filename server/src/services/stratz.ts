import { fetch } from 'undici'

export interface StratzHeroSummary {
  id: number
  name: string
}

export interface StratzSnapshot {
  sourceAvailable: boolean
  heroes: StratzHeroSummary[]
}

/**
 * Attempts to read public STRATZ data without login/auth flow.
 * If a public endpoint is not accessible, returns an empty snapshot.
 */
export async function fetchStratzPublicSnapshot(): Promise<StratzSnapshot> {
  const endpoint = 'https://api.stratz.com/api/v1/Hero'
  const resp = await fetch(endpoint, { method: 'GET' })

  if (!resp.ok) {
    return { sourceAvailable: false, heroes: [] }
  }

  const payload = (await resp.json()) as unknown
  if (!Array.isArray(payload)) {
    return { sourceAvailable: true, heroes: [] }
  }

  const heroes = payload
    .map((entry) => {
      const raw = entry as Record<string, unknown>
      const id = typeof raw.id === 'number' ? raw.id : null
      const name =
        typeof raw.displayName === 'string'
          ? raw.displayName
          : typeof raw.shortName === 'string'
            ? raw.shortName
            : typeof raw.name === 'string'
              ? raw.name
              : null

      if (!id || !name) return null
      return { id, name }
    })
    .filter((item): item is StratzHeroSummary => item !== null)

  return { sourceAvailable: true, heroes }
}
