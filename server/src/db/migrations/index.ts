import type { DatabaseInstance } from '../index.js'
import * as m001 from './001_initial_schema.js'

export interface Migration {
  up: (db: DatabaseInstance) => void
  down?: (db: DatabaseInstance) => void
}

// Export all migrations in order
// Add new migrations here as they are created
export const allMigrations: Record<string, Migration> = {
  '001_initial_schema': m001,
}
