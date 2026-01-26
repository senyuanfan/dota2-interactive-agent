import { fetch } from 'undici'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'openrouter'
  apiKey: string
  model?: string
  baseUrl?: string
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

const DEFAULT_MODELS: Record<LLMConfig['provider'], string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'openai/gpt-4o-mini',
}

const DEFAULT_URLS: Record<LLMConfig['provider'], string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

/**
 * LLM Service - Abstraction layer for multiple LLM providers
 */
export class LLMService {
  private config: LLMConfig
  private baseUrl: string
  private model: string

  constructor(config: LLMConfig) {
    this.config = config
    this.baseUrl = config.baseUrl ?? DEFAULT_URLS[config.provider]
    this.model = config.model ?? DEFAULT_MODELS[config.provider]
  }

  /**
   * Send a chat completion request
   */
  async chat(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const { temperature = 0.7, maxTokens = 1024 } = options

    if (this.config.provider === 'anthropic') {
      return this.chatAnthropic(messages, { temperature, maxTokens })
    }

    // OpenAI and OpenRouter use the same API format
    return this.chatOpenAI(messages, { temperature, maxTokens })
  }

  /**
   * OpenAI/OpenRouter chat completion
   */
  private async chatOpenAI(
    messages: ChatMessage[],
    options: { temperature: number; maxTokens: number }
  ): Promise<LLMResponse> {
    const url = `${this.baseUrl}/chat/completions`

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.config.apiKey}`,
    }

    // OpenRouter requires additional headers
    if (this.config.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'http://localhost'
      headers['X-Title'] = 'dota2-interactive-agent'
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`LLM request failed (${resp.status}): ${text}`)
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }

    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new Error('Empty response from LLM')
    }

    return {
      content,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    }
  }

  /**
   * Anthropic chat completion
   */
  private async chatAnthropic(
    messages: ChatMessage[],
    options: { temperature: number; maxTokens: number }
  ): Promise<LLMResponse> {
    const url = `${this.baseUrl}/messages`

    // Extract system message if present
    let systemPrompt: string | undefined
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content
      } else {
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: conversationMessages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`Anthropic request failed (${resp.status}): ${text}`)
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const textContent = data.content?.find((c) => c.type === 'text')?.text ?? ''
    if (!textContent) {
      throw new Error('Empty response from Anthropic')
    }

    return {
      content: textContent,
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens ?? 0,
            outputTokens: data.usage.output_tokens ?? 0,
          }
        : undefined,
    }
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model
  }

  /**
   * Get the current provider
   */
  getProvider(): string {
    return this.config.provider
  }
}

/**
 * Create an LLM service from environment variables
 * Prefers Anthropic > OpenAI > OpenRouter
 */
export function createLLMService(env: {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  OPENROUTER_API_KEY?: string
  LLM_PROVIDER?: string
  LLM_MODEL?: string
}): LLMService {
  // Allow explicit provider override
  const preferredProvider = env.LLM_PROVIDER as LLMConfig['provider'] | undefined

  if (preferredProvider === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return new LLMService({
      provider: 'anthropic',
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  if (preferredProvider === 'openai' && env.OPENAI_API_KEY) {
    return new LLMService({
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  if (preferredProvider === 'openrouter' && env.OPENROUTER_API_KEY) {
    return new LLMService({
      provider: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  // Auto-detect provider based on available keys
  if (env.ANTHROPIC_API_KEY) {
    return new LLMService({
      provider: 'anthropic',
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  if (env.OPENAI_API_KEY) {
    return new LLMService({
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  if (env.OPENROUTER_API_KEY) {
    return new LLMService({
      provider: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      model: env.LLM_MODEL,
    })
  }

  throw new Error('No LLM API key provided. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY')
}
