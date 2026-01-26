import type { UserProfile } from '../routes/profile.js'
import type { ExtractedPreferences } from './profile.js'

export interface MemoryUpdate {
  field: string
  oldValue: unknown
  newValue: unknown
  action: 'add' | 'replace' | 'merge'
}

export interface EvolutionResult {
  updated: Partial<UserProfile>
  changes: MemoryUpdate[]
}

/**
 * Intelligently merge new preferences into existing profile
 * without losing old data
 */
export function evolveProfile(
  current: UserProfile,
  extracted: ExtractedPreferences
): EvolutionResult {
  const updated: Partial<UserProfile> = {}
  const changes: MemoryUpdate[] = []

  // preferredHeroes: Add new heroes, don't remove old ones
  if (extracted.heroes && extracted.heroes.length > 0) {
    const currentHeroes = new Set(current.preferredHeroes)
    const newHeroes = extracted.heroes.filter((h) => !currentHeroes.has(h))

    if (newHeroes.length > 0) {
      const mergedHeroes = [...current.preferredHeroes, ...newHeroes]
      updated.preferredHeroes = mergedHeroes
      changes.push({
        field: 'preferredHeroes',
        oldValue: current.preferredHeroes,
        newValue: mergedHeroes,
        action: 'add',
      })
    }
  }

  // preferredRoles: Add new roles, keep existing
  if (extracted.roles && extracted.roles.length > 0) {
    const currentRoles = new Set(current.preferredRoles.map((r) => r.toLowerCase()))
    const newRoles = extracted.roles.filter((r) => !currentRoles.has(r.toLowerCase()))

    if (newRoles.length > 0) {
      const mergedRoles = [...current.preferredRoles, ...newRoles]
      updated.preferredRoles = mergedRoles
      changes.push({
        field: 'preferredRoles',
        oldValue: current.preferredRoles,
        newValue: mergedRoles,
        action: 'add',
      })
    }
  }

  // skillLevel: Replace with newer value (user may have ranked up)
  if (extracted.skillLevel) {
    if (current.skillLevel !== extracted.skillLevel) {
      updated.skillLevel = extracted.skillLevel
      changes.push({
        field: 'skillLevel',
        oldValue: current.skillLevel,
        newValue: extracted.skillLevel,
        action: 'replace',
      })
    }
  }

  // playstyle: Append/refine if different, don't overwrite completely
  if (extracted.playstyle) {
    if (!current.playstyle) {
      updated.playstyle = extracted.playstyle
      changes.push({
        field: 'playstyle',
        oldValue: current.playstyle,
        newValue: extracted.playstyle,
        action: 'replace',
      })
    } else if (!current.playstyle.toLowerCase().includes(extracted.playstyle.toLowerCase())) {
      // Merge playstyles if they're different
      const merged = `${current.playstyle}, ${extracted.playstyle}`
      updated.playstyle = merged
      changes.push({
        field: 'playstyle',
        oldValue: current.playstyle,
        newValue: merged,
        action: 'merge',
      })
    }
  }

  // learningGoals: Add new goals
  if (extracted.learningGoals && extracted.learningGoals.length > 0) {
    const currentGoals = new Set(current.learningGoals.map((g) => g.toLowerCase()))
    const newGoals = extracted.learningGoals.filter(
      (g) => !currentGoals.has(g.toLowerCase())
    )

    if (newGoals.length > 0) {
      const mergedGoals = [...current.learningGoals, ...newGoals]
      updated.learningGoals = mergedGoals
      changes.push({
        field: 'learningGoals',
        oldValue: current.learningGoals,
        newValue: mergedGoals,
        action: 'add',
      })
    }
  }

  return { updated, changes }
}

/**
 * Build a personalized system prompt based on user profile
 */
export function buildPersonalizedPrompt(profile: UserProfile): string {
  const parts: string[] = ['You are a concise Dota 2 assistant.']

  // Add skill level context
  if (profile.skillLevel) {
    parts.push(`You are helping a ${profile.skillLevel} player.`)
  }

  // Add hero preferences
  if (profile.preferredHeroes.length > 0) {
    const heroList = profile.preferredHeroes.slice(0, 5).join(', ')
    parts.push(`They main: ${heroList}.`)
  }

  // Add role preferences
  if (profile.preferredRoles.length > 0) {
    const roleList = profile.preferredRoles.join(', ')
    parts.push(`They prefer playing ${roleList}.`)
  }

  // Add playstyle
  if (profile.playstyle) {
    parts.push(`Their playstyle is ${profile.playstyle}.`)
  }

  // Add learning goals
  if (profile.learningGoals.length > 0) {
    const goalList = profile.learningGoals.slice(0, 3).join(', ')
    parts.push(`Current learning goals: ${goalList}.`)
  }

  parts.push('Tailor advice to their level and preferences. Use provided sources. Cite with [n]. Keep answers tight and practical.')

  return parts.join(' ')
}

/**
 * Check if profile has meaningful data for personalization
 */
export function hasProfileData(profile: UserProfile): boolean {
  return (
    profile.preferredHeroes.length > 0 ||
    profile.preferredRoles.length > 0 ||
    !!profile.skillLevel ||
    !!profile.playstyle ||
    profile.learningGoals.length > 0
  )
}
