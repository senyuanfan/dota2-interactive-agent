import { GoogleGenAI } from '@google/genai'

export interface VideoDigest {
  title: string
  summary: string
}

const DIGEST_PROMPT = `You are a Dota 2 analyst. Watch this YouTube video and produce a structured digest.

Output format (plain text, no markdown fences):
TITLE: <video title or best description>
SUMMARY:
- Key points about heroes, items, strategies, meta shifts, or patch changes
- Include specific hero/item names, numbers, and timestamps when relevant
- Note any tier lists, rankings, or matchup advice
- Keep each bullet concise and actionable

Focus only on Dota 2 gameplay-relevant information. Ignore intros, sponsorships, and off-topic segments.`

/**
 * Send a YouTube video URL to Gemini for analysis and return a structured digest
 */
export async function digestYouTubeVideo(
  videoUrl: string,
  geminiApiKey: string
): Promise<VideoDigest> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: DIGEST_PROMPT },
          {
            fileData: {
              fileUri: videoUrl,
              mimeType: 'video/*',
            },
          },
        ],
      },
    ],
  })

  const text = response.text ?? ''
  if (!text.trim()) {
    throw new Error('Empty response from Gemini')
  }

  return parseDigest(text, videoUrl)
}

function parseDigest(raw: string, fallbackUrl: string): VideoDigest {
  const titleMatch = raw.match(/^TITLE:\s*(.+)$/m)
  const title = titleMatch?.[1]?.trim() || fallbackUrl

  const summaryIdx = raw.indexOf('SUMMARY:')
  const summary =
    summaryIdx !== -1
      ? raw.slice(summaryIdx + 'SUMMARY:'.length).trim()
      : raw.trim()

  return { title, summary }
}
