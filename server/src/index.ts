import cors from 'cors'
import express from 'express'

const PORT = Number(process.env.PORT ?? 8787)

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cors())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/chat', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : ''
  if (!message.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  res.json({
    answer:
      'Server is running. Next step is wiring SerpAPI search + LLM + SQLite notes.',
    citations: [],
  })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
