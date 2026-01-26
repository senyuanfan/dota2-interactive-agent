import { fetch } from 'undici'

export interface WebCitation {
  title: string
  url: string
  snippet?: string
}

/**
 * Search the web using SerpAPI
 */
export async function searchWeb(
  query: string,
  apiKey: string,
  options: { limit?: number } = {}
): Promise<WebCitation[]> {
  const { limit = 5 } = options

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', apiKey)

  const resp = await fetch(url, { method: 'GET' })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`SerpAPI error ${resp.status}: ${text}`)
  }

  const json = (await resp.json()) as {
    organic_results?: Array<{
      title?: string
      link?: string
      snippet?: string
    }>
  }

  const items =
    json.organic_results?.map((r) => ({
      title: r.title ?? r.link ?? 'Untitled',
      url: r.link ?? '',
      snippet: r.snippet ?? '',
    })) ?? []

  return items.filter((r) => r.url).slice(0, limit)
}
