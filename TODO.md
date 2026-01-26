# Dota2 Interactive Agent

An agent that understands the game of Dota2, its mechanics, up-to-date meta, culture in pro games and also in player communities, as well as how to communicate with a gamer in real-time before, during, and after games.

---

## Tech Stack

- **Frontend**: React + Tailwind CSS
- **Backend**: Express.js
- **Database**: SQLite
- **Language**: TypeScript
- **LLM**: OpenAI API (designed for easy switch to Anthropic API)

---

## Stage 1: Game Understanding (Current Focus)

### 1. Meta Understanding
Grasp understanding of the **current** version of the game. Don't store data locally if easily accessible via wiki - fetch dynamically.

**What to store locally:**
- Pro meta / tier lists
- Hero guides relevant to user's preferred heroes
- Current patch version (for change detection)

**What to fetch dynamically:**
- Hero stats, abilities, talents (via Dota2 Wiki)
- Item details
- Basic game mechanics

**Tasks:**
- [ ] Create wiki scraper service for dynamic data fetching
- [ ] Implement patch version checker (periodic + manual trigger)
- [ ] Build meta/tier list storage and update system
- [ ] Create hero guide storage linked to user preferences

### 2. User Understanding
Talk to the user and maintain evolving memory of their preferences.

**User profile to track:**
- Preferred heroes
- Preferred roles (carry, mid, offlane, support)
- Skill level / MMR bracket
- Playstyle (aggressive, farming-focused, teamfight-oriented, etc.)
- Learning goals

**Tasks:**
- [x] Design user profile schema in SQLite
- [x] Build preference extraction from conversations
- [x] Implement memory update system (evolving, not just overwriting)
- [x] Create user profile API endpoints

### 3. Knowledge Base from User Inputs
Digest content from URLs and transform into agent knowledge.

**Supported sources:**
- Blog posts / articles (web scraping)
- Videos (future: Gemini integration - leave blank for now)

**Tasks:**
- [ ] Build URL content scraper (article extraction)
- [ ] Implement content summarization and knowledge extraction
- [ ] Store processed knowledge in SQLite
- [ ] Link knowledge entries to relevant heroes/topics

### 4. Before/After Game Discussion
Chat interface to discuss game-related questions using the knowledge base.

**Tasks:**
- [ ] Build chat API with conversation history
- [ ] Implement RAG (retrieval-augmented generation) for knowledge base
- [ ] Create context injection for user profile + relevant knowledge
- [ ] Store and manage chat history

---

## Stage 1 Implementation Plan

### Phase 1: Project Setup ✅
- [x] Initialize monorepo structure (client + server)
- [x] Set up Express server with TypeScript
- [x] Set up React client with Tailwind CSS
- [x] Configure SQLite database with migrations
- [x] Set up OpenAI API client (with abstraction layer for future provider switch)

### Phase 2: Core Backend
- [x] Database schema design and implementation
  - Users table (single user for now, but extensible)
  - UserProfile table (preferences, memory)
  - KnowledgeBase table (articles, guides, meta info)
  - ChatHistory table
  - PatchInfo table
- [ ] Wiki scraper service (Dota2 Wiki, Liquipedia)
- [ ] URL content scraper service
- [x] LLM service abstraction (OpenAI, Anthropic, OpenRouter)

### Phase 3: User Profile System ✅
- [x] User profile CRUD API
- [x] Conversation-based preference extraction
- [x] Memory evolution logic
- [x] Integration with chat flow (personalized system prompts)

### Phase 4: Knowledge Base System
- [ ] URL ingestion endpoint
- [ ] Content processing pipeline
- [ ] Patch checker (cron job + manual trigger)
- [ ] Meta/tier list fetching and storage

### Phase 5: Chat Interface
- [ ] Chat API with streaming support
- [ ] RAG implementation for context retrieval
- [ ] Chat history management

### Phase 6: Frontend
- [ ] Chat interface component
- [ ] Chat history sidebar
- [ ] Knowledge base management UI
- [ ] User profile settings page

---

## Stage 2: Real-time Coaching (Future)

1. **Game planning** - During drafting phase, communicate draft and game plan with the user. Give them key takeaways.
2. **Game coaching** - During gameplay, communicate item choices and strategy by analyzing current game state.

*Requires: Screen capture toolchain, real-time processing*

---

## Tools & Integrations

1. Modularized skills and subagents for subtask breakdown
2. LLMs with audio/screen understanding (Stage 2)
3. Web scraping for wiki and content ingestion
4. Dota2-related MCP servers (if available)

---

## Resources

1. [Dota2 Official Website](https://www.dota2.com/home)
2. [Dota2 Counter Pick](https://dotapicker.com/counterpick)
3. [Dota2 Wiki](https://dota2.fandom.com/wiki/Dota_2_Wiki)
4. [Liquipedia Dota2](https://liquipedia.net/dota2/Main_Page)