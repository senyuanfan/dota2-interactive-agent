import type { DatabaseInstance } from '../index.js'

export function up(db: DatabaseInstance): void {
  // Users table (single user for now, but extensible)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      username TEXT UNIQUE,
      display_name TEXT
    );
  `)

  // User profile table (preferences, memory)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      preferred_heroes TEXT DEFAULT '[]',
      preferred_roles TEXT DEFAULT '[]',
      skill_level TEXT,
      mmr_bracket TEXT,
      playstyle TEXT,
      learning_goals TEXT DEFAULT '[]'
    );
  `)

  // Knowledge base table (articles, guides, meta info)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      source_url TEXT,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      tags TEXT DEFAULT '[]',
      related_heroes TEXT DEFAULT '[]',
      related_topics TEXT DEFAULT '[]'
    );
  `)

  // Chat history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      citations TEXT DEFAULT '[]'
    );
  `)

  // Patch info table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patch_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      patch_version TEXT NOT NULL UNIQUE,
      patch_notes_url TEXT,
      release_date TEXT,
      is_current INTEGER NOT NULL DEFAULT 0
    );
  `)

  // Notes table (from original schema - web search results)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      query TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_title TEXT,
      snippet TEXT,
      tags TEXT,
      summary TEXT
    );
  `)

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_source_type ON knowledge_base(source_type);
    CREATE INDEX IF NOT EXISTS idx_patch_info_current ON patch_info(is_current);
  `)

  // Insert a default user
  db.exec(`
    INSERT OR IGNORE INTO users (id, username, display_name) VALUES (1, 'default', 'Default User');
    INSERT OR IGNORE INTO user_profiles (user_id) VALUES (1);
  `)
}

export function down(db: DatabaseInstance): void {
  db.exec(`
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS patch_info;
    DROP TABLE IF EXISTS chat_history;
    DROP TABLE IF EXISTS knowledge_base;
    DROP TABLE IF EXISTS user_profiles;
    DROP TABLE IF EXISTS users;
  `)
}
