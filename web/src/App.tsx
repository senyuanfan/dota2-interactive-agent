import { useMemo, useState } from 'react'
import './App.css'

type Role = 'user' | 'assistant'

type Citation = {
  title: string
  url: string
}

type ChatMessage = {
  role: Role
  content: string
  citations?: Citation[]
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Ask me anything about Dota 2. I’ll search the web and include sources.',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const historyForApi = useMemo(
    () =>
      messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  async function onSend() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setError(null)
    setIsLoading(true)
    setInput('')

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ]
    setMessages(nextMessages)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForApi,
        }),
      })

      if (!res.ok) {
        setError(`Request failed (${res.status})`)
        setIsLoading(false)
        return
      }

      const data: { answer: string; citations: Citation[] } = await res.json()
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
        },
      ])
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="appTitle">Dota 2 Interactive Agent</div>
        <div className="appSubtitle">Web-search-first answers with sources</div>
      </header>

      <main className="chatMain" aria-label="Chat">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`msgRow ${m.role === 'user' ? 'msgUser' : 'msgAssistant'}`}
          >
            <div className="msgBubble">
              <div className="msgText">{m.content}</div>
              {m.role === 'assistant' && m.citations && m.citations.length > 0 ? (
                <div className="citations">
                  <div className="citationsTitle">Sources</div>
                  <ol className="citationsList">
                    {m.citations.map((c) => (
                      <li key={c.url}>
                        <a href={c.url} target="_blank" rel="noreferrer">
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="msgRow msgAssistant">
            <div className="msgBubble">
              <div className="msgText">Thinking…</div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="chatFooter">
        {error ? <div className="errorBanner">{error}</div> : null}

        <div className="composer">
          <input
            className="composerInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about heroes, items, matchups, mechanics…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) onSend()
            }}
            disabled={isLoading}
          />
          <button className="composerButton" onClick={onSend} disabled={isLoading}>
            Send
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App
