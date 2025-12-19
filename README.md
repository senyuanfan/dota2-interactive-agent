# Dota 2 Interactive Agent

This project is a locally runnable web app that serves as an interactive Dota 2 agent, providing domain knowledge (heroes, items, mechanics, strategy) to support gameplay questions and decisions.

## Features
- Chatbot-like web interface (OpenAI-style) for user interaction.
- Main chat agent supporting both text and real-time streamed voice modes.
- Secondary information agent leveraging web search and browsing tools (e.g., Liquipedia, Dotabuff) for data gathering.
- Notes database for storing custom data such as hero synonyms (including multilingual support).

## Stack
- Frontend: TypeScript
- Backend: Node.js with TypeScript
- Database: SQLite (locally stored, entries are tagged for efficient retrieval)

## Requirements
- Node.js 18+ and npm (npm is used across all packages)

## Setup
- Install root dev tools (Playwright, types): `npm install`
- Install server deps: `cd server && npm install`
- Install web deps: `cd web && npm install`
- First time running Playwright tests: `npx playwright install`

## Run
- Backend API (default http://localhost:8787):
  - Set keys: `SERPAPI_API_KEY` (required), `OPENAI_API_KEY` or `OPENROUTER_API_KEY`, optional `PORT` and `SQLITE_PATH` (defaults to `../data/notes.db`).
  - Dev mode (auto-reload): `cd server && npm run dev`
  - Prod entry (no reload): `cd server && npm run start`
- Web app (http://localhost:5173 with proxy to 8787):
  - `cd web && npm run dev`
  - The Vite dev server proxies `/api` to the backend at `localhost:8787`.

## Test
- End-to-end tests use Playwright and run from the repo root.
- Install browsers once: `npx playwright install`
- Run tests headlessly: `npx playwright test`
- Open the HTML report after a run: `npx playwright show-report`