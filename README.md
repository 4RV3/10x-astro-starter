# FlashAI (MVP)

Web app for creating and studying flashcards using **spaced repetition (SM-2)**. The MVP focuses on **fast AI-generated flashcards from pasted text**, plus manual creation and simple review sessions. Each flashcard stores a **source snippet** to aid verification and reduce hallucination risk.

## Table of Contents

- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

## Project description

**FlashAI** helps users turn learning materials (notes/articles/textbooks copied as text) into flashcards quickly.

Key MVP outcomes:
- Generate **Basic** flashcards (front/back, text-only) from pasted text using AI
- Mass-accept and save generated flashcards
- Create/edit/delete flashcards manually
- Study due cards using a simple, correct **SM-2** scheduling flow
- Safer QA workflow via **mandatory source snippet** on each card + UI warning to verify content

## Tech stack

Frontend:
- **Astro 5** + **React 19** for interactive components
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- UI building blocks: **shadcn/ui** approach (Radix primitives), `class-variance-authority`, `tailwind-merge`, `clsx`

Backend:
- **Supabase** (PostgreSQL, Auth, SDK)

AI:
- **OpenRouter.ai** as the model gateway (supports multiple model vendors and spend limits)

CI/CD & Hosting:
- **GitHub Actions** for CI/CD
- **DigitalOcean** for hosting (Docker-based deployment)

## Getting started locally

### Prerequisites

- Node.js **v22.14.0** (see `.nvmrc`)
- npm

### Setup

1. Install Node with your preferred tool (example using nvm):
   ```bash
   nvm install
   nvm use
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Build & preview production:
   ```bash
   npm run build
   npm run preview
   ```

## Available scripts

From `package.json`:
- `npm run dev` — start Astro dev server
- `npm run build` — build for production
- `npm run preview` — preview production build
- `npm run lint` — run ESLint
- `npm run lint:fix` — run ESLint with auto-fix
- `npm run format` — run Prettier

## Project scope

### MVP (in scope)

Auth & security:
- Register/login/logout with **Supabase Auth**
- Profile data (e.g. `username`) stored in a separate `profiles` table (**1:1** with `auth.users`)
- `username` uniqueness enforced on a normalized value (e.g. `citext` or unique index on `lower(username)`)
- Session persists between refreshes
- Data isolation: users can only access their own flashcards and review progress (**RLS** with `owner_id = auth.uid()`)
- Password storage/hashing handled by Supabase Auth (no custom password hashes in app DB)

Flashcards:
- Single type: **Basic** (front/back), **text-only**
- Fields (minimum):
  - `front`, `back`
  - `sourceSnippet` (**required; non-empty at DB level**)
  - SM-2 metadata stored on `cards` (minimum: `ease_factor`, `interval_days`, `repetitions`, `due_at`, `last_reviewed_at`)
  - timestamps (created/updated)
  - `ownerId`
- Optional later: `card_reviews` table for per-review grade history (metrics/audit)

AI generation:
- Input: paste text (no product limits for MVP; technical limits enforced in DB/UI)
- Output: list of suggested cards (front/back + **source snippet per card**)
- UX: **save all** generated cards in one action
- Reliability: “save all” should be persisted **transactionally** (all-or-nothing)

CRUD:
- List cards (no decks/tags/search in MVP)
- View details (front/back/source snippet)
- Edit and delete (with confirmation; **hard delete in MVP**)
- List should remain usable at scale (pagination or lazy loading)
- DB indexing requirement: queries for due cards should be supported by an index on (`owner_id`, `due_at`, `id`)

Study (SM-2):
- Review due cards
- Front-first → reveal back → grade (SM-2 compatible)
- Update SM-2 scheduling after grading
- Empty state: “No cards due”

Minimal analytics/events (for MVP validation):
- `AI_generate_requested`, `AI_generate_succeeded/failed`
- `AI_cards_generated_count`, `AI_cards_saved_count`
- `Manual_card_created`
- `Study_session_started`, `Card_reviewed` (with grade), `No_cards_due_shown`

### Out of scope (explicitly not in MVP)

- Advanced algorithms beyond simple SM-2 (e.g. Anki/SuperMemo variants)
- Import formats like PDF/DOCX (paste text only)
- Sharing between users
- Native mobile apps
- Organization features: decks, tags, folders
- Search
- Advanced quality workflows (ranking/feedback per card as required steps)

## Project status

**MVP — in development.**  
Scope and acceptance criteria are defined in `.ai/prd.md`. Features may change until the first MVP release.

## License

MIT
