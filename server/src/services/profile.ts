import type { LLMService, ChatMessage } from './llm.js'

export interface ExtractedPreferences {
  heroes?: string[]
  roles?: string[]
  skillLevel?: string
  playstyle?: string
  learningGoals?: string[]
}

const EXTRACTION_PROMPT = `You are analyzing a Dota 2 player's message to extract their preferences and profile information.

Extract ONLY information that is CLEARLY and EXPLICITLY stated in the message. Do not assume or infer.

Return a JSON object with these optional fields (include only fields that are clearly mentioned):
- heroes: array of hero names mentioned positively (e.g., "I play Anti-Mage" or "I love PA")
- roles: array of roles mentioned (valid: "carry", "mid", "offlane", "soft support", "hard support")
- skillLevel: their rank if mentioned (e.g., "Herald", "Guardian", "Crusader", "Archon", "Legend", "Ancient", "Divine", "Immortal")
- playstyle: description of their playstyle if mentioned (e.g., "aggressive", "farming focused", "team fighter")
- learningGoals: array of things they want to learn or improve

Rules:
- Only include fields where information is EXPLICITLY stated
- Hero names should be full official names (e.g., "Anti-Mage" not "AM", "Phantom Assassin" not "PA")
- Be conservative - when in doubt, don't include it
- Return ONLY valid JSON, no explanation

User message: `

/**
 * Extract Dota 2 preferences from a user message using LLM
 */
export async function extractPreferences(
  message: string,
  llm: LLMService
): Promise<ExtractedPreferences> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: EXTRACTION_PROMPT + message,
      },
    ]

    const response = await llm.chat(messages, {
      temperature: 0.1,
      maxTokens: 300,
    })

    // Parse the JSON response
    const content = response.content.trim()

    // Extract JSON from potential markdown code blocks
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)

    // Validate and sanitize the response
    const result: ExtractedPreferences = {}

    if (Array.isArray(parsed.heroes) && parsed.heroes.length > 0) {
      result.heroes = parsed.heroes.filter((h: unknown) => typeof h === 'string')
    }

    if (Array.isArray(parsed.roles) && parsed.roles.length > 0) {
      const validRoles = ['carry', 'mid', 'offlane', 'soft support', 'hard support', 'support']
      result.roles = parsed.roles.filter(
        (r: unknown) => typeof r === 'string' && validRoles.includes(r.toLowerCase())
      )
    }

    if (typeof parsed.skillLevel === 'string' && parsed.skillLevel.trim()) {
      result.skillLevel = parsed.skillLevel.trim()
    }

    if (typeof parsed.playstyle === 'string' && parsed.playstyle.trim()) {
      result.playstyle = parsed.playstyle.trim()
    }

    if (Array.isArray(parsed.learningGoals) && parsed.learningGoals.length > 0) {
      result.learningGoals = parsed.learningGoals.filter((g: unknown) => typeof g === 'string')
    }

    return result
  } catch (err) {
    // If extraction fails, return empty object (non-blocking)
    console.error('Preference extraction failed:', err)
    return {}
  }
}

/**
 * Check if extracted preferences contain any data
 */
export function hasPreferences(prefs: ExtractedPreferences): boolean {
  return (
    (prefs.heroes && prefs.heroes.length > 0) ||
    (prefs.roles && prefs.roles.length > 0) ||
    (prefs.learningGoals && prefs.learningGoals.length > 0) ||
    !!prefs.skillLevel ||
    !!prefs.playstyle
  )
}
