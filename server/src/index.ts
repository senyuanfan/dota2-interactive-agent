import path from 'node:path'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'

import { initDatabase } from './db/index.js'
import { createLLMService } from './services/llm.js'
import { createChatRouter, createHealthRouter, createProfileRouter } from './routes/index.js'

// Load root-level .env (one directory above /server)
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

// Environment configuration
const PORT = Number(process.env.PORT ?? 8787)
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY ?? ''
const SQLITE_PATH = resolveDbPath(process.env.SQLITE_PATH)

// Initialize database
const db = initDatabase(SQLITE_PATH)

// Initialize LLM service
const llm = createLLMService({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
})

console.log(`Using LLM provider: ${llm.getProvider()} (${llm.getModel()})`)

// Create Express app
const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors())

// Register routes
app.use('/api/health', createHealthRouter())
app.use('/api/profile', createProfileRouter({ db }))
app.use('/api/chat', createChatRouter({ db, llm, serpApiKey: SERPAPI_API_KEY }))

// Start server
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down...')
  db.close()
  process.exit(0)
})

function resolveDbPath(envPath?: string): string {
  if (envPath) {
    return path.resolve(process.cwd(), envPath)
  }
  return path.resolve(process.cwd(), '..', 'data', 'notes.db')
}
