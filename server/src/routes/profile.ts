import { Router } from 'express'
import type { DatabaseInstance } from '../db/index.js'

interface ProfileRouterDeps {
  db: DatabaseInstance
}

export interface UserProfile {
  userId: number
  preferredHeroes: string[]
  preferredRoles: string[]
  skillLevel: string | null
  mmrBracket: string | null
  playstyle: string | null
  learningGoals: string[]
  createdAt: string
  updatedAt: string
}

interface DbProfileRow {
  id: number
  user_id: number
  created_at: string
  updated_at: string
  preferred_heroes: string
  preferred_roles: string
  skill_level: string | null
  mmr_bracket: string | null
  playstyle: string | null
  learning_goals: string
}

function rowToProfile(row: DbProfileRow): UserProfile {
  return {
    userId: row.user_id,
    preferredHeroes: JSON.parse(row.preferred_heroes || '[]'),
    preferredRoles: JSON.parse(row.preferred_roles || '[]'),
    skillLevel: row.skill_level,
    mmrBracket: row.mmr_bracket,
    playstyle: row.playstyle,
    learningGoals: JSON.parse(row.learning_goals || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createProfileRouter({ db }: ProfileRouterDeps): Router {
  const router = Router()

  // GET /api/profile - Get current user profile
  router.get('/', (_req, res) => {
    try {
      const row = db
        .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
        .get(1) as DbProfileRow | undefined

      if (!row) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }

      res.json(rowToProfile(row))
    } catch (err) {
      console.error('Error fetching profile:', err)
      res.status(500).json({ error: 'Failed to fetch profile' })
    }
  })

  // PUT /api/profile - Update profile fields
  router.put('/', (req, res) => {
    try {
      const body = req.body || {}
      const updates: string[] = []
      const params: Record<string, unknown> = { user_id: 1 }

      if (body.preferredHeroes !== undefined) {
        updates.push('preferred_heroes = @preferred_heroes')
        params.preferred_heroes = JSON.stringify(body.preferredHeroes)
      }
      if (body.preferredRoles !== undefined) {
        updates.push('preferred_roles = @preferred_roles')
        params.preferred_roles = JSON.stringify(body.preferredRoles)
      }
      if (body.skillLevel !== undefined) {
        updates.push('skill_level = @skill_level')
        params.skill_level = body.skillLevel
      }
      if (body.mmrBracket !== undefined) {
        updates.push('mmr_bracket = @mmr_bracket')
        params.mmr_bracket = body.mmrBracket
      }
      if (body.playstyle !== undefined) {
        updates.push('playstyle = @playstyle')
        params.playstyle = body.playstyle
      }
      if (body.learningGoals !== undefined) {
        updates.push('learning_goals = @learning_goals')
        params.learning_goals = JSON.stringify(body.learningGoals)
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No valid fields to update' })
        return
      }

      updates.push("updated_at = datetime('now')")

      const sql = `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = @user_id`
      db.prepare(sql).run(params)

      // Fetch and return updated profile
      const row = db
        .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
        .get(1) as DbProfileRow

      res.json(rowToProfile(row))
    } catch (err) {
      console.error('Error updating profile:', err)
      res.status(500).json({ error: 'Failed to update profile' })
    }
  })

  // GET /api/profile/heroes - Get preferred heroes list
  router.get('/heroes', (_req, res) => {
    try {
      const row = db
        .prepare('SELECT preferred_heroes FROM user_profiles WHERE user_id = ?')
        .get(1) as { preferred_heroes: string } | undefined

      if (!row) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }

      res.json({ heroes: JSON.parse(row.preferred_heroes || '[]') })
    } catch (err) {
      console.error('Error fetching heroes:', err)
      res.status(500).json({ error: 'Failed to fetch heroes' })
    }
  })

  // PUT /api/profile/heroes - Update preferred heroes
  router.put('/heroes', (req, res) => {
    try {
      const heroes = req.body?.heroes
      if (!Array.isArray(heroes)) {
        res.status(400).json({ error: 'heroes must be an array' })
        return
      }

      db.prepare(
        "UPDATE user_profiles SET preferred_heroes = ?, updated_at = datetime('now') WHERE user_id = ?"
      ).run(JSON.stringify(heroes), 1)

      res.json({ heroes })
    } catch (err) {
      console.error('Error updating heroes:', err)
      res.status(500).json({ error: 'Failed to update heroes' })
    }
  })

  return router
}

/**
 * Get user profile from database
 */
export function getProfile(db: DatabaseInstance, userId: number = 1): UserProfile | null {
  const row = db
    .prepare('SELECT * FROM user_profiles WHERE user_id = ?')
    .get(userId) as DbProfileRow | undefined

  return row ? rowToProfile(row) : null
}

/**
 * Update user profile in database
 */
export function updateProfile(
  db: DatabaseInstance,
  profile: Partial<UserProfile>,
  userId: number = 1
): void {
  const updates: string[] = []
  const params: Record<string, unknown> = { user_id: userId }

  if (profile.preferredHeroes !== undefined) {
    updates.push('preferred_heroes = @preferred_heroes')
    params.preferred_heroes = JSON.stringify(profile.preferredHeroes)
  }
  if (profile.preferredRoles !== undefined) {
    updates.push('preferred_roles = @preferred_roles')
    params.preferred_roles = JSON.stringify(profile.preferredRoles)
  }
  if (profile.skillLevel !== undefined) {
    updates.push('skill_level = @skill_level')
    params.skill_level = profile.skillLevel
  }
  if (profile.mmrBracket !== undefined) {
    updates.push('mmr_bracket = @mmr_bracket')
    params.mmr_bracket = profile.mmrBracket
  }
  if (profile.playstyle !== undefined) {
    updates.push('playstyle = @playstyle')
    params.playstyle = profile.playstyle
  }
  if (profile.learningGoals !== undefined) {
    updates.push('learning_goals = @learning_goals')
    params.learning_goals = JSON.stringify(profile.learningGoals)
  }

  if (updates.length === 0) return

  updates.push("updated_at = datetime('now')")
  const sql = `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = @user_id`
  db.prepare(sql).run(params)
}
