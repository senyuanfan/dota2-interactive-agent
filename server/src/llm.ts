import { fetch } from 'undici'
import type { ChatMessage, WebCitation } from './types.js'

export function buildPrompt(query: string, sources: WebCitation[]) {
  const numbered = sources
    .map(
      (s, idx) =>
        `[${idx + 1}] ${s.title}\n${s.snippet ?? ''}\nURL: ${s.url}`.trim(),
    )
    .join('\n\n')

  const system: ChatMessage = {
    role: 'system',
    content:
      'You are a concise Dota 2 assistant. Use the provided sources. Cite with [n]. Keep answers tight and practical.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Question: ${query}\n\nSources:\n${numbered}\n\nInstructions: Answer in 3-6 sentences. Use [n] citations. If unsure, say so briefly.`,
  }

  return { system, user }
}

export async function callLLM({
  messages,
  openAiKey,
  openRouterKey,
  openAiModel,
  openRouterModel,
}: {
  messages: ChatMessage[]
  openAiKey: string
  openRouterKey: string
  openAiModel: string
  openRouterModel: string
}): Promise<string> {
  const useOpenAI = !!openAiKey
  const endpoint = useOpenAI
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions'

  const apiKey = useOpenAI ? openAiKey : openRouterKey
  if (!apiKey) {
    throw new Error('No API key available for selected provider')
  }
  const model = useOpenAI ? openAiModel : openRouterModel

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...(useOpenAI
        ? {}
        : {
            'HTTP-Referer': 'http://localhost',
            'X-Title': 'dota2-interactive-agent',
          }),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 400,
      messages,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`LLM request failed ${resp.status}: ${text}`)
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw new Error('Empty completion from LLM')
  }
  return content
}
