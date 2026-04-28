# Dota 2 Interactive Agent

An AI-powered assistant that understands Dota 2, its mechanics, current meta, and helps players improve their game through personalized advice.

## Tech Stack

- **Frontend**: React + Tailwind CSS + Vite
- **Backend**: Express.js + TypeScript
- **Database**: SQLite (better-sqlite3)
- **LLM**: Multi-provider support (Anthropic, OpenAI, OpenRouter)

## Project Structure

```
dota2-interactive-agent/
├── server/                 # Express.js backend
│   └── src/
│       ├── db/            # Database setup and migrations
│       ├── routes/        # API routes (chat, profile, health)
│       └── services/      # Business logic (LLM, search, profile, memory)
├── web/                   # React frontend
└── data/                  # SQLite database files
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   cd ../web && npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and set your API keys:
   ```
   ANTHROPIC_API_KEY=your_key_here
   # or
   OPENAI_API_KEY=your_key_here
   # or
   OPENROUTER_API_KEY=your_key_here

   SERPAPI_API_KEY=your_serpapi_key
   GEMINI_API_KEY=your_gemini_key
   OPENDOTA_API_KEY=your_opendota_key_optional
   ```

3. **Start the server**
   ```bash
   cd server && npm run dev
   ```

4. **Start the frontend**
   ```bash
   cd web && npm run dev
   ```

## API Endpoints

### Chat
- `POST /api/chat` - Send a message and get AI response with web-sourced citations

### Knowledge Ingestion
- `POST /api/ingest` - Digest a YouTube URL with Gemini and store the summary in the knowledge base
- `POST /api/meta/sync` - Fetch current OpenDota/STRATZ public data and store patch-tagged meta entries

### Profile
- `GET /api/profile` - Get current user profile
- `PUT /api/profile` - Update profile fields
- `GET /api/profile/heroes` - Get preferred heroes list
- `PUT /api/profile/heroes` - Update preferred heroes

### Health
- `GET /api/health` - Server health check

## Features

### User Profile System
The agent remembers and evolves its understanding of the user:
- **Preferred Heroes**: Heroes the user plays
- **Preferred Roles**: carry, mid, offlane, support
- **Skill Level**: Herald to Immortal
- **Playstyle**: aggressive, farming-focused, etc.
- **Learning Goals**: What the user wants to improve

Preferences are automatically extracted from conversations using LLM and merged intelligently (new data adds to existing, doesn't overwrite).

### Personalized Responses
Chat responses are tailored based on the user's profile - advice is adjusted for their skill level, preferred heroes, and learning goals.

### Knowledge Base and Meta Sync
The backend can store digested YouTube videos and current-patch hero/meta data in SQLite. Meta sync uses OpenDota hero stats plus STRATZ public hero references, tags entries by patch version, and replaces older OpenDota/STRATZ entries during each manual sync.

## Development

See [TODO.md](./TODO.md) for the full roadmap and current progress.
