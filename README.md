# Strength Coach 🏋️‍♀️

A conversational agent that acts as a personal strength coach: logging sets, analyzing progression, providing form cues, and managing fatigue. Built with React, a Node/SQLite backend, and a streaming LLM interface that works with OpenAI-compatible providers (OpenAI, Groq).

---

## Problem framing

Most fitness apps are recording tools. They let you log a set, see a chart, and that's it. The gap they don't close: **what should I do next, and why?**

I built Strength Coach around that missing piece. The core insight is that strength training is a long game. Every session is connected to the one before it and informs the one after it. A useful tool shouldn't just store what happened; it should actively manage the progression.

**What this is:** a conversational interface that acts as a real coach. When you log a set it immediately compares it to your history, calculates volume delta, and tells you what to target next session. When you report fatigue it adjusts the recommendation. When you ask for form cues it gives you the mechanical setup, not generic advice.

**What I deliberately left out:**
- *Workout plan generation* — generating cookie-cutter programs is easy and already saturated. The harder and more valuable problem is adapting to what actually happened in training.
- *Social / gamification* — not relevant to the core coaching loop.
- *Multi-user auth* — the architecture is single-user for now (no `user_id` scoping). The future path is documented in [Future Enhancements](#future-enhancements).
- *Mobile app* — responsive web covers the use case without the distribution overhead.

**Who this is for:** lifters who already know what they're doing and want a system that tracks progression and tells them when to push and when to back off. Not beginners who need a program generator.

---

## Extending to other personas

This architecture isn't specific to strength coaching. It's a pattern for any domain where you want a conversational agent with memory, structured tool calls, and a persistent data layer. Swapping the persona is mostly a config-and-schema change, not a rewrite.

**The three things you replace per persona:**

1. **System prompt** (`src/lib/prompt.js`): defines the agent's voice, decision-making rules, and what it asks before calling tools. A support agent gets escalation logic and ticket-triage rules; a metrics analyst gets data-interpretation heuristics and thresholds.

2. **Tool definitions + dispatcher** (`src/lib/tools.js`): the JSON schemas and `executeTool` switch. New tools call new backend endpoints. The streaming tool-call loop in `useChatSession.js` doesn't change.

3. **Database tables + backend endpoints** (`server/index.js`): replace `logs` / `recovery` with whatever the domain needs. The session/messages tables are persona-agnostic and stay as-is.

**Example personas and what changes:**

| Persona | System prompt focus | New tools | New DB tables |
|---------|--------------------|-----------|----|
| Customer support | Ticket triage, escalation policy, tone rules | `open_ticket`, `get_ticket_history`, `escalate_to_agent` | `tickets`, `escalations` |
| Business metrics | KPI interpretation, anomaly thresholds, trend analysis | `query_metric`, `get_trend`, `flag_anomaly` | `metrics`, `snapshots` |
| Nutrition coach | Macro targets, meal logging, deficit management | `log_meal`, `get_nutrition_history`, `calculate_tdee` | `meals`, `nutrition_goals` |
| Study assistant | Spaced repetition rules, topic tracking | `log_session`, `get_weak_topics`, `schedule_review` | `study_sessions`, `topics` |

The UI (chat area, sidebar, cards, streaming indicator) is completely reusable. The only frontend component that needs persona-specific work is `AgentCard.jsx`, which renders tool result cards. Everything else (session management, message persistence, streaming, mobile layout) carries over unchanged.

**Shortest path to a new persona:**
1. Fork the repo, rename the app
2. Rewrite `src/lib/prompt.js`
3. Replace tool schemas in `src/lib/tools.js` and update `executeTool`
4. Add new tables to `server/index.js` and wire up the endpoints
5. Add card variants in `AgentCard.jsx` for the new tool types

The test structure mirrors the code structure. `tools.test.js`, `cards.test.js`, and `api.test.js` give you test patterns to copy for the new domain.

---

## Demo

<video src="https://github.com/user-attachments/assets/91bd6509-e23c-46bc-8d83-2b873c2cf5de" width="100%" controls autoplay loop muted></video>

---

## Screenshots

| Home | Chat with Set Logged | Training Log | Mobile Sidebar |
|------|---------------------|--------------|----------------|
| ![Home](docs/screenshots/home.png) | ![Chat](docs/screenshots/chat-set-logged.png) | ![Log](docs/screenshots/training-log.png) | ![Mobile](docs/screenshots/mobile-sidebar.png) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                                                                 │
│  ┌──────────┐   ┌────────────────────────────────────────────┐  │
│  │ Sidebar  │   │              Main Content                  │  │
│  │          │   │                                            │  │
│  │ Sessions │   │  ┌──────────────────────────────────────┐  │  │
│  │ History  │   │  │  NewChatScreen (hero + suggestions)  │  │  │
│  │          │   │  └──────────────────────────────────────┘  │  │
│  │ Training │   │               ── or ──                     │  │
│  │ Log link │   │  ┌──────────────────────────────────────┐  │  │
│  └──────────┘   │  │  ChatArea (MessageBubble + AgentCard)│  │  │
│                 │  └──────────────────────────────────────┘  │  │
│                 │  ┌──────────────────────────────────────┐  │  │
│                 │  │  InputBox (textarea + send)          │  │  │
│                 │  └──────────────────────────────────────┘  │  │
│                 └────────────────────────────────────────────┘  │
└────────────────────┬──────────────────┬─────────────────────────┘
                     │                  │
          ┌──────────▼──────┐  ┌───────▼──────────────────┐
          │  LLM Provider   │  │  Backend (Express + SQLite)│
          │                 │  │                            │
          │  OpenAI / Groq  │  │  /api/sessions             │
          │  streaming SSE  │  │  /api/sessions/:id/messages│
          │  + tool calls   │  │  /api/logs                 │
          └─────────────────┘  │  /api/recovery             │
                               │  /api/training-log         │
                               └────────────────────────────┘
```

### Key data flows

```
User types message
       │
       ▼
App.jsx handleSend()
  ├─ create session if new (POST /api/sessions)
  ├─ save user message (POST /api/sessions/:id/messages)
  └─ useChatSession.sendMessage()
         │
         ▼
  streamLLMChat() ──► LLM API (SSE stream)
         │
         ├─ text delta ──► update message bubble in real time
         │
         └─ functionCall ──► executeTool()
                │                  │
                │            ├─ web_search ──► DuckDuckGo Instant Answer API
                │            ├─ log_workout_set ──► POST /api/logs
                │            ├─ get_exercise_history ──► GET /api/logs?exercise=
                │            ├─ look_up_form ──► local form cues dict
                │            └─ log_recovery_metrics ──► POST /api/recovery
                │
                └─ buildCardData() ──► AgentCard ──► recurse with tool result
```

### File map

```
conversational-system/
├── src/
│   ├── App.jsx                      # Thin orchestration: nav state → components
│   ├── index.css                    # All active styles + media queries
│   ├── components/
│   │   ├── AgentCard.jsx            # Tool-result card (progress/form/recovery/search)
│   │   ├── ChatArea.jsx             # Scrolling message list + streaming indicator
│   │   ├── InputBox.jsx             # Textarea + send button (normal + centered modes)
│   │   ├── MessageBubble.jsx        # Single message with avatar + optional card
│   │   ├── NewChatScreen.jsx        # Hero + suggestion cards + centered input
│   │   ├── Sidebar.jsx              # Session list, new chat, training log nav
│   │   └── TrainingLogView.jsx      # Training log table
│   ├── hooks/
│   │   └── useChatSession.js        # All streaming + tool-call loop logic
│   ├── lib/
│   │   ├── llm.js                   # Provider detection, streamLLMChat entry point
│   │   ├── prompt.js                # SYSTEM_PROMPT (coaching persona + tool rules)
│   │   ├── tools.js                 # Tool schemas + executeTool dispatcher
│   │   ├── cards.js                 # Pure buildCardData() — tool result → card shape
│   │   ├── api.js                   # Thin fetch wrappers for backend REST API
│   │   └── adapters/
│   │       ├── openai.js            # OpenAI-compatible SSE streaming + tool call parsing
│   │       └── groq.js              # Groq adapter (wraps openai.js with Groq base URL)
│   └── __tests__/
│       ├── setup.js                 # @testing-library/jest-dom + jsdom patches
│       ├── tools.test.js            # executeTool dispatcher (all tools incl. web_search)
│       ├── cards.test.js            # buildCardData() — all tool types + edge cases
│       └── components/
│           ├── AgentCard.test.jsx
│           ├── ChatArea.test.jsx
│           ├── InputBox.test.jsx
│           ├── MessageBubble.test.jsx
│           ├── NewChatScreen.test.jsx
│           ├── Sidebar.test.jsx
│           └── TrainingLogView.test.jsx
└── server/
    └── index.js                     # Express: SQLite CRUD + server-side progression logic
```

---

## User Journeys

### 1. Log a Set

1. Open app → hero screen with four suggestion cards
2. Click **"Log a Set"** or type e.g. `Bench press 80kg x 5`
3. Coach calls `log_workout_set` → set saved to SQLite
4. A **Set Logged** card appears showing exercise, weight, and reps
5. Coach replies with progression analysis: volume delta, next target weight
6. Session appears in the sidebar titled from the first model reply

> **Tool called:** `log_workout_set(exercise, weight, unit, reps)`

---

### 2. Check Progression

1. Click **"Check Progression"** → sends *"Check my bench press progression and tell me what to target next."*
2. Coach calls `get_exercise_history("bench press")` → fetches last 5 sets from DB
3. An **Analyzing Log History** card appears with set count
4. Coach responds with volume trend, PR analysis, and next-session target
5. If no history exists, coach asks you to log some sets first

> **Tool called:** `get_exercise_history(exercise)`

---

### 3. Form Check

1. Click **"Form Check"** → sends *"Give me form cues for squat."*
2. Coach calls `look_up_form("squat")` → returns cue string from built-in dict
3. A **Form Check: SQUAT** card appears with the cues
4. Coach walks through setup, execution, common mistakes, and primary cue

> **Tool called:** `look_up_form(exercise)`  
> **Supported:** squat, bench press, deadlift, overhead press (generic fallback for others)

---

### 4. Manage Fatigue

1. Click **"Manage Fatigue"** → sends *"I want to assess my readiness to train today. Ask me what you need."*
2. Coach asks for sleep hours, soreness (1-10), energy (1-10)
3. User provides metrics → coach calls `log_recovery_metrics`
4. A **Recovery Logged** card appears with all metrics
5. Coach gives a training recommendation: progress / maintain / deload

> **Tool called:** `log_recovery_metrics(sleep_hours, soreness_level, energy_level)`

---

### 5. Resume a Session

1. Click any session in the sidebar
2. Full message history loads from SQLite (including cards)
3. History is reconstructed as readable text for the LLM context so coaching memory is preserved
4. User continues the conversation; coach remembers prior sets and context

---

### 6. Training Log

1. Click **Training Log** in the sidebar
2. All logged sets and recovery entries appear sorted newest first
3. Each row shows date, exercise, weight, reps, and a server-side recommendation
4. Recommendations use double-progression logic comparing each set to the previous for that exercise

---

### 7. Mobile (hamburger menu)

1. On screens ≤ 768px the sidebar is hidden; the header shows a ≡ button
2. Tap ≡ → sidebar slides in from left with a dimmed overlay behind it
3. Tap the overlay, a session item, Training Log, or New Workout → sidebar closes automatically

---

## Setup

### Prerequisites

- Node.js 18+
- An API key for OpenAI or Groq

### 1 — Install

```bash
make install
```

This runs `npm install` in the root and `cd server && npm install` in one shot.

### 2 — Configure

Copy `.env.example` to `.env` and fill in your key:

```env
# Groq (free tier, fast)
VITE_GROQ_API_KEY=gsk_...

# — or — OpenAI
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_MODEL=gpt-4o   # optional, defaults to gpt-4o
```

### 3 — Run

**Option A — two terminals (recommended for development):**

```bash
# Terminal 1 — SQLite REST API on :3001
node server/index.js

# Terminal 2 — Vite dev server on :5173
npm run dev
```

**Option B — one command (backend in background):**

```bash
make dev-bg
```

Open `http://localhost:5173`.

### Makefile reference

| Command | What it does |
|---------|-------------|
| `make install` | Install all deps (frontend + backend) |
| `make dev-bg` | Start backend in background, frontend in foreground |
| `make test` | Run all tests (server + frontend) |
| `make test-server` | Jest tests for the Express API and business logic |
| `make test-client` | Vitest tests for the frontend tool dispatcher |
| `make build` | Production build |
| `make lint` | ESLint |

---

## Tests

```bash
make test        # run everything (server + frontend)
make test-server # Jest: Express API + business logic
make test-client # Vitest: frontend tools + components
```

**~100 tests total** across three suites:

| Suite | Framework | What's covered |
|-------|-----------|----------------|
| `server/__tests__/logic.test.js` | Jest | `getExerciseRecommendation` and `getRecoveryRecommendation`: all progression branches (baseline, load PR, volume increase, top-end reps, stagnation) and all recovery branches (low sleep, high soreness, low energy, green light, priority ordering) |
| `server/__tests__/api.test.js` | Jest + supertest | All REST endpoints against an isolated temp SQLite DB: POST/GET logs, POST recovery, GET training-log, POST/GET sessions, POST/GET/PUT messages |
| `src/__tests__/tools.test.js` | Vitest | `executeTool` dispatcher: `web_search` (results, related topics, empty, network error), form cues, `log_workout_set`, `get_exercise_history`, `log_recovery_metrics`, unknown tool error |
| `src/__tests__/cards.test.js` | Vitest | `buildCardData()`: every tool type including `web_search`, edge cases (missing fields, empty history, fallback values) |
| `src/__tests__/components/*.test.jsx` | Vitest + Testing Library | One file per component: render, interaction, props, edge cases |

The server tests spin up the full Express app against a throwaway `test.sqlite` that's deleted when Jest exits. No manual cleanup needed.

Component tests run in jsdom via Vitest + `@testing-library/react`. No test renderer or snapshot tests; everything asserts against real DOM output.

---

## LLM Provider Support

| Provider | Env var | Default model |
|----------|---------|---------------|
| Groq | `VITE_GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| OpenAI | `VITE_OPENAI_API_KEY` | `gpt-4o` |

Set `VITE_LLM_PROVIDER=groq` or `VITE_LLM_PROVIDER=openai` to force a provider. If both keys are absent, the app errors with a clear message. Any OpenAI-compatible endpoint can be used by editing `src/lib/adapters/openai.js`.

---

## Tools (function calling)

| Tool | When triggered | What it does |
|------|---------------|--------------|
| `web_search` | User asks about research, techniques, or topics needing current info | Queries DuckDuckGo Instant Answer API (free, no key required) |
| `log_workout_set` | User reports exercise + weight + reps | Saves to `logs` table; returns saved record |
| `get_exercise_history` | User asks about progression for a named exercise | Returns last 5 sets for that exercise |
| `look_up_form` | User asks for form cues or reports discomfort | Returns cues from built-in dict |
| `log_recovery_metrics` | User provides sleep/soreness/energy data | Saves to `recovery` table |

The coach will **not** call tools with missing or placeholder values. It asks the user for specific data first (enforced via system prompt rules).

### Web search

Uses the [DuckDuckGo Instant Answer API](https://duckduckgo.com/api): no API key, no sign-up, no rate-limit registration. Queries run client-side from the browser. Results include an abstract (when available) and up to four related topics.

This makes the coach useful for questions like "what does the research say about rest periods" or "what's the difference between RPE and RIR" without leaving the conversation.

---

## Database Schema

```sql
CREATE TABLE logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise  TEXT NOT NULL,
  weight    REAL NOT NULL,
  unit      TEXT NOT NULL,       -- 'kg' or 'lbs'
  reps      INTEGER NOT NULL,
  date      TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recovery (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sleep_hours    REAL,
  soreness_level INTEGER,        -- 1-10
  energy_level   INTEGER,        -- 1-10
  notes          TEXT,
  date           TEXT NOT NULL,
  timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  title     TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  role       TEXT NOT NULL,      -- 'user' or 'model'
  content    TEXT,
  card_data  TEXT,               -- JSON blob for UI cards
  timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Future Enhancements

### Multi-user Auth & Per-user Session Manager

The app is currently single-user (no auth, no `user_id` scoping). The planned path to multi-user:

#### 1. Auth layer — Clerk (or Better Auth)

Add Clerk for OAuth / email sign-in. This handles sessions, JWTs, and the sign-in UI with minimal code:

```bash
npm install @clerk/clerk-react
```

Wrap the app in `<ClerkProvider>`, gate routes with `<SignedIn>` / `<SignedOut>`, and extract `userId` from `useAuth()` on every request.

#### 2. DB schema — add `user_id` to all tables

```sql
ALTER TABLE sessions  ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE messages  ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE logs      ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE recovery  ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
```

Index `user_id` on `sessions` and `logs` for query performance.

#### 3. Backend — scope every query

Pass the JWT from the frontend (`Authorization: Bearer <token>`), verify it with Clerk's SDK in an Express middleware, then attach `req.userId` to every handler:

```js
// middleware
const { userId } = await clerkClient.verifyToken(req.headers.authorization.split(' ')[1]);
req.userId = userId;

// scoped query (example)
db.all(`SELECT * FROM sessions WHERE user_id = ? ORDER BY timestamp DESC`, [req.userId], ...);
```

All `INSERT` statements receive `req.userId` as the `user_id` value.

#### 4. Frontend — user-level session sidebar

The sidebar currently shows all sessions globally. After auth:

- Sessions are fetched with the user's JWT attached, so only their sessions return
- A user avatar / sign-out button replaces the hamburger area on desktop
- "New workout" creates a session tagged to the current `userId`
- Loading a session verifies `session.user_id === currentUserId` before rendering

#### 5. Storage — move to Postgres for concurrent writes

SQLite works fine for a single user. For multiple concurrent users replace it with Postgres (e.g. Supabase free tier):

```bash
npm install pg
```

The query interface is nearly identical; replace `db.run` / `db.all` with `pool.query`. No schema changes beyond the `user_id` columns above.

#### Migration path summary

| Step | Effort | Dependency |
|------|--------|------------|
| Add Clerk auth | ~2 hrs | `@clerk/clerk-react`, `@clerk/express` |
| Add `user_id` columns + index | ~30 min | DB migration script |
| Scope backend queries | ~2 hrs | Clerk server SDK |
| Scoped sidebar + auth UI | ~2 hrs | `useAuth()`, `<UserButton>` |
| Postgres (optional for scale) | ~1 day | `pg`, hosted Postgres |
