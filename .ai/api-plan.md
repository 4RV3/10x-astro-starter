# REST API Plan

This document defines a REST-style API for the FlashAI MVP, built on Supabase (PostgreSQL + Supabase Auth) and consumed from an Astro + React frontend.  
All endpoints are intended to be called via Supabase’s HTTP interface (RPC, table endpoints) or a thin custom backend if needed, but are described here as logical HTTP resources.

---

## 1. Resources

1. **Auth / Sessions**  
   - Backed by: `auth.users` (managed by Supabase Auth) + `public.profiles`  
   - Purpose: registration, login, logout, current user profile.

2. **Profiles**  
   - Table: `public.profiles`  
   - Relationship: 1:1 with `auth.users` via `profiles.id = auth.users.id`  
   - Purpose: store `username` and basic profile metadata.

3. **Cards**  
   - Table: `public.cards`  
   - Relationship: many-to-1 with `auth.users` via `cards.owner_id`  
   - Purpose: flashcards (front/back/source_snippet) plus SM‑2 scheduling state.

4. **(Optional, later) Card Reviews / Analytics**  
   - Table: `public.card_reviews` (optional; not needed for MVP as per DB plan)  
   - Purpose: audit and analytics of reviews. Omitted from endpoints for MVP unless explicitly enabled later.

5. **AI Generation (Batch)**  
   - Backed by: custom RPC function(s) operating on `public.cards`  
   - Purpose: accept a big text input, ask OpenRouter-hosted LLM, return generated card proposals, and persist batches atomically on “Save all”.

6. **Study / SM‑2 Sessions**  
   - Backed by: `public.cards` (+ optional RPC for SM‑2 updates)  
   - Purpose: fetch due cards, record grades, update SM‑2 metadata.

---

## 2. Endpoints

> Note:  
> - All endpoints (except health) require authentication via Supabase Auth (JWT/bearer token).  
> - All data is automatically filtered by RLS (`owner_id = auth.uid()` / `id = auth.uid()`), but responses and error codes are specified here from a client perspective.  
> - For each endpoint, request/response shapes are the logical JSON shapes used by the frontend; exact wire format may be implemented via Supabase table endpoints or RPC.

### 2.1 Auth & Session

#### 2.1.1 Register

- **Method**: `POST`  
- **Path**: `/auth/register`  
- **Description**: Register a new user with `username` and `password`, create profile row, and start session.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "username": "my_username"
}
```

**Response 201**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "id": "uuid",
    "username": "my_username",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "session": {
    "access_token": "jwt",
    "expires_at": 1700000000
  }
}
```

**Success codes**

- `201 Created` – user and profile created, session started.

**Error codes**

- `400 Bad Request` – invalid email/username/password (format, length, missing fields).  
- `409 Conflict` – `username` or email already taken.  
- `500 Internal Server Error` – failure to create user or profile.

---

#### 2.1.2 Login

- **Method**: `POST`  
- **Path**: `/auth/login`  
- **Description**: Login via `username` and `password`.

> Implementation note: Supabase Auth is email-based. To support “login by username”, the backend will:
> 1. Look up `profiles.username = :username` to get `user_id` and associated email.
> 2. Call Supabase Auth sign-in with that email + password.
> 
> From the API consumer’s POV it remains `/auth/login` with username.

**Request body**

```json
{
  "username": "my_username",
  "password": "strong-password"
}
```

**Response 200**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "id": "uuid",
    "username": "my_username"
  },
  "session": {
    "access_token": "jwt",
    "expires_at": 1700000000
  }
}
```

**Success codes**

- `200 OK` – login success.

**Error codes**

- `400 Bad Request` – missing username or password.  
- `401 Unauthorized` – invalid credentials (generic error, does not reveal whether user exists).  
- `500 Internal Server Error` – failure at auth provider.

---

#### 2.1.3 Logout

- **Method**: `POST`  
- **Path**: `/auth/logout`  
- **Description**: Invalidate current session / token.

**Request**

- Authorization header: `Authorization: Bearer <access_token>`  
- No body.

**Response 204**

- Empty body.

**Success codes**

- `204 No Content` – successfully logged out / session invalidated.

**Error codes**

- `401 Unauthorized` – missing/invalid token.

---

#### 2.1.4 Get Current User Profile

- **Method**: `GET`  
- **Path**: `/auth/me`  
- **Description**: Returns current user’s auth info and profile.

**Request**

- Authorization header: `Authorization: Bearer <access_token>`.

**Response 200**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "id": "uuid",
    "username": "my_username",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

**Success codes**

- `200 OK` – authenticated and profile found.

**Error codes**

- `401 Unauthorized` – not authenticated or session expired.  
- `404 Not Found` – user exists but profile not created (edge case).

---

### 2.2 Profiles

Profiles are implicitly handled in auth endpoints, but a minimal CRUD for username editing is useful.

#### 2.2.1 Get Own Profile

- **Method**: `GET`  
- **Path**: `/profiles/me`  
- **Description**: Get authenticated user’s profile.

**Response 200**

```json
{
  "id": "uuid",
  "username": "my_username",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-02T08:00:00Z"
}
```

**Success codes**

- `200 OK`.

**Error codes**

- `401 Unauthorized`.  
- `404 Not Found` – no profile row.

---

#### 2.2.2 Update Own Profile (username)

- **Method**: `PATCH`  
- **Path**: `/profiles/me`  
- **Description**: Update `username` for current user.

**Request body**

```json
{
  "username": "new_username"
}
```

**Response 200**

```json
{
  "id": "uuid",
  "username": "new_username",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-10T09:00:00Z"
}
```

**Validation**

- Non-empty username after trimming.  
- Optional: length 3–32; allowed chars regex `^[A-Za-z0-9_.]+$`.  
- Uniqueness of `lower(username)`.

**Success codes**

- `200 OK` – updated.

**Error codes**

- `400 Bad Request` – invalid username format/length.  
- `409 Conflict` – username already taken.  
- `401 Unauthorized`.  

---

### 2.3 Cards (Manual + General CRUD)

#### 2.3.1 Create Card (Manual)

- **Method**: `POST`  
- **Path**: `/cards`  
- **Description**: Create a manual card. `origin` defaults to `"manual"`.

**Request body**

```json
{
  "front": "What is a REST API?",
  "back": "An architectural style for distributed systems using stateless communication.",
  "source_snippet": "Chapter 3: REST APIs, section 3.1"
}
```

**Validation**

- `front`, `back`, `source_snippet`:  
  - required, non-empty after trim.  
  - DB has `CHECK (length(btrim(...)) > 0)` so API should pre-validate and send 400 on violation.  
- Optional technical length limits (to be aligned with DB `CHECK(char_length(...))` if configured).

**Response 201**

```json
{
  "id": "uuid",
  "origin": "manual",
  "front": "What is a REST API?",
  "back": "An architectural style for distributed systems using stateless communication.",
  "source_snippet": "Chapter 3: REST APIs, section 3.1",
  "ease_factor": 2.5,
  "interval_days": 0,
  "repetitions": 0,
  "due_at": "2024-01-01T12:00:00Z",
  "last_reviewed_at": null,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

**Success codes**

- `201 Created`.

**Error codes**

- `400 Bad Request` – validation errors (missing fields, blank strings, too long).  
- `401 Unauthorized`.  
- `500 Internal Server Error` – DB error not covered by validation.

---

#### 2.3.2 List Cards (Paginated)

- **Method**: `GET`  
- **Path**: `/cards`  
- **Description**: List cards belonging to the current user, with pagination.

**Query parameters**

- `page` – optional, integer ≥ 1, default `1`.  
- `page_size` – optional, integer, default `20`, max e.g. `100`.  
- `sort` – optional, `"created_at_asc"` | `"created_at_desc"` | `"due_at_asc"`; default `"created_at_desc"`.  
- `origin` – optional filter, `"manual"` | `"ai"`.

**Example request**

`GET /cards?page=1&page_size=20&sort=created_at_desc&origin=ai`

**Response 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "origin": "ai",
      "front": "Question?",
      "back": "Answer.",
      "source_snippet": "...",
      "ease_factor": 2.5,
      "interval_days": 0,
      "repetitions": 0,
      "due_at": "2024-01-01T12:00:00Z",
      "last_reviewed_at": null,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
    // ...
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 123,
    "total_pages": 7
  }
}
```

**Index usage**

- `cards_owner_created_id_ix` for `ORDER BY created_at` queries.  
- `cards_owner_due_id_ix` if listing by `due_at`.

**Success codes**

- `200 OK`.

**Error codes**

- `401 Unauthorized`.  
- `400 Bad Request` – invalid pagination params.

---

#### 2.3.3 Get Single Card

- **Method**: `GET`  
- **Path**: `/cards/{id}`  
- **Description**: Get card details.

**Path params**

- `id` – UUID of the card.

**Response 200**

```json
{
  "id": "uuid",
  "origin": "ai",
  "front": "Question?",
  "back": "Answer.",
  "source_snippet": "...",
  "ease_factor": 2.5,
  "interval_days": 0,
  "repetitions": 3,
  "due_at": "2024-01-03T12:00:00Z",
  "last_reviewed_at": "2024-01-02T12:00:00Z",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-02T12:00:00Z"
}
```

**Success codes**

- `200 OK`.

**Error codes**

- `401 Unauthorized`.  
- `404 Not Found` – card does not exist or belongs to another user (RLS hides it).

---

#### 2.3.4 Update Card (Front/Back/Source)

- **Method**: `PATCH`  
- **Path**: `/cards/{id}`  
- **Description**: Edit card text fields only. SM‑2 fields are updated via study endpoints only.

**Request body**

```json
{
  "front": "Updated question?",
  "back": "Updated answer.",
  "source_snippet": "Updated source."
}
```

- All three fields optional, but at least one must be present.  
- Each provided field must be non-empty after trim.

**Response 200**

```json
{
  "id": "uuid",
  "origin": "manual",
  "front": "Updated question?",
  "back": "Updated answer.",
  "source_snippet": "Updated source.",
  "ease_factor": 2.5,
  "interval_days": 0,
  "repetitions": 0,
  "due_at": "2024-01-01T12:00:00Z",
  "last_reviewed_at": null,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-02T12:00:00Z"
}
```

**Success codes**

- `200 OK`.

**Error codes**

- `400 Bad Request` – all fields missing, or provided field empty/whitespace only.  
- `401 Unauthorized`.  
- `404 Not Found` – card not found or not owned.  

---

#### 2.3.5 Delete Card (Hard Delete)

- **Method**: `DELETE`  
- **Path**: `/cards/{id}`  
- **Description**: Delete card permanently.

**Response 204**

- Empty body.

**Success codes**

- `204 No Content`.

**Error codes**

- `401 Unauthorized`.  
- `404 Not Found`.

> UI requirement: confirmation is handled client-side before calling this endpoint.

---

### 2.4 AI Generation Flow

The AI flow contains:  
1. Generate proposals from pasted text (no DB writes).  
2. Batch save accepted proposals transactionally.  
3. Optionally discard proposals client-side (no API call needed).

#### 2.4.1 Generate Cards from Text (Preview Only)

- **Method**: `POST`  
- **Path**: `/ai/generate`  
- **Description**: Generate card proposals (front/back/source_snippet) from pasted text using OpenRouter models. Does not persist to DB.

**Request body**

```json
{
  "input_text": "Long study material text pasted by the user..."
}
```

**Validation**

- `input_text` required, non-empty after trim.  
- Technical max length (e.g. 20k–50k characters) to avoid model overload; if exceeded, return 413.

**Response 200**

```json
{
  "cards": [
    {
      "front": "Question 1?",
      "back": "Answer 1.",
      "source_snippet": "Relevant fragment from the input..."
    },
    {
      "front": "Question 2?",
      "back": "Answer 2.",
      "source_snippet": "Another fragment..."
    }
  ],
  "model": "openrouter/model-name",
  "tokens_used": {
    "prompt": 1234,
    "completion": 567
  }
}
```

**Success codes**

- `200 OK`.

**Error codes**

- `400 Bad Request` – empty `input_text` or too long.  
- `401 Unauthorized`.  
- `503 Service Unavailable` – AI provider unavailable / timeout.  
- `500 Internal Server Error` – unexpected OpenRouter error.

> UI: shows proposals, enables “Save all” and “Discard”.

---

#### 2.4.2 Save All Generated Cards (Transactional Batch)

- **Method**: `POST`  
- **Path**: `/ai/cards/batch`  
- **Description**: Persist an entire batch of AI-generated cards atomically as `origin = "ai"`.

**Request body**

```json
{
  "cards": [
    {
      "front": "Question 1?",
      "back": "Answer 1.",
      "source_snippet": "Fragment 1..."
    },
    {
      "front": "Question 2?",
      "back": "Answer 2.",
      "source_snippet": "Fragment 2..."
    }
  ]
}
```

**Validation**

For each card:

- `front`, `back`, `source_snippet` required, non-empty after trim.  
- Optional: length limits consistent with DB `CHECK`.  
- `cards` array must be non-empty.

Atomicity:

- Implement via SQL RPC function `public.insert_cards_batch(cards jsonb)` that:  
  - uses `auth.uid()` as `owner_id` for all rows, ignoring any ownerId from client.  
  - sets `origin = 'ai'` for all rows.  
  - validates non-empty trimmed fields (or rely on DB `CHECK` with proper error mapping).  
  - performs single `INSERT ... SELECT FROM jsonb_to_recordset()` within one transaction.  
- On any error, entire batch is rolled back.

**Response 201**

```json
{
  "cards": [
    {
      "id": "uuid-1",
      "origin": "ai",
      "front": "Question 1?",
      "back": "Answer 1.",
      "source_snippet": "Fragment 1...",
      "ease_factor": 2.5,
      "interval_days": 0,
      "repetitions": 0,
      "due_at": "2024-01-01T12:00:00Z",
      "last_reviewed_at": null,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    },
    {
      "id": "uuid-2",
      "origin": "ai",
      "front": "Question 2?",
      "back": "Answer 2.",
      "source_snippet": "Fragment 2...",
      "ease_factor": 2.5,
      "interval_days": 0,
      "repetitions": 0,
      "due_at": "2024-01-01T12:00:00Z",
      "last_reviewed_at": null,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Success codes**

- `201 Created` – all cards saved.

**Error codes**

- `400 Bad Request` – validation errors (empty fields, no cards, too long).  
- `401 Unauthorized`.  
- `422 Unprocessable Entity` – DB-level constraint error (e.g. whitespace-only source_snippet) not caught by pre-validation.  
- `500 Internal Server Error` – transaction failure.

> “Discard all” is handled purely on frontend by dropping local proposals (no endpoint needed).

---

### 2.5 Study / SM‑2 Endpoints

The SM‑2 algorithm is applied per card when user rates their recall. All SM‑2-related updates are encapsulated in a dedicated endpoint for auditability and consistency.

#### 2.5.1 Get Due Cards

- **Method**: `GET`  
- **Path**: `/study/due-cards`  
- **Description**: Return a page of cards that are due for review at the current time.

**Query parameters**

- `limit` – optional, default `20`, max e.g. `100`.  
- `from_now` – optional, ISO timestamp or relative offset, default `now()`. Usually no need; due is defined as `due_at <= now()`.

**Example request**

`GET /study/due-cards?limit=30`

**Response 200 (cards available)**

```json
{
  "cards": [
    {
      "id": "uuid-1",
      "front": "Question 1?",
      "back": "Answer 1.",
      "source_snippet": "Fragment 1...",
      "ease_factor": 2.5,
      "interval_days": 3,
      "repetitions": 4,
      "due_at": "2024-01-03T12:00:00Z",
      "last_reviewed_at": "2024-01-01T12:00:00Z"
    }
    // ...
  ]
}
```

**Response 200 (no cards due)**

```json
{
  "cards": []
}
```

**Index usage**

- Uses `cards_owner_due_id_ix` (`owner_id, due_at, id`) with `WHERE owner_id = auth.uid() AND due_at <= now() ORDER BY due_at, id LIMIT :limit`.

**Success codes**

- `200 OK`.

**Error codes**

- `401 Unauthorized`.

---

#### 2.5.2 Submit Review / Update SM‑2 State

- **Method**: `POST`  
- **Path**: `/study/review`  
- **Description**: Submit a single review for a card, including grade (0–5). SM‑2 algorithm is applied server-side and card’s scheduling fields are updated.

**Request body**

```json
{
  "card_id": "uuid-1",
  "grade": 4
}
```

**Validation**

- `card_id` required, must be UUID and owned by `auth.uid()` (checked by RLS and explicit query).  
- `grade` required, integer between 0 and 5 (inclusive).  
- Card must exist; otherwise 404.

**Server behavior**

- Load card’s `ease_factor`, `interval_days`, `repetitions`.  
- Apply SM‑2 algorithm (simplified version consistent with PRD):  
  - For grades < 3: reset interval to 1, and optionally repetitions to 0; adjust `ease_factor`.  
  - For grades ≥ 3: increment repetitions, increase interval based on formula and `ease_factor`.  
  - Constrain `ease_factor` to [1.3, 3.0] to match DB `CHECK`.  
- Set `last_reviewed_at = now()`; set new `due_at`.  
- Persist changes in a single transaction.  
- (Optional) create history row in `card_reviews` for analytics.

**Response 200**

```json
{
  "card": {
    "id": "uuid-1",
    "ease_factor": 2.6,
    "interval_days": 3,
    "repetitions": 5,
    "due_at": "2024-01-05T12:00:00Z",
    "last_reviewed_at": "2024-01-02T12:00:00Z"
  }
}
```

**Success codes**

- `200 OK`.

**Error codes**

- `400 Bad Request` – invalid `grade` or missing fields.  
- `401 Unauthorized`.  
- `404 Not Found` – card not found / not owned.  
- `422 Unprocessable Entity` – SM‑2 update would violate DB constraints (should not happen if logic is correct).  
- `500 Internal Server Error`.

---

### 2.6 Utility / Health

#### 2.6.1 Health Check

- **Method**: `GET`  
- **Path**: `/health`  
- **Description**: Basic liveness / readiness.

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## 3. Authentication and Authorization

### 3.1 Authentication

- Mechanism: **Supabase Auth** (email & password) with JWT access tokens.  
- Client workflow:
  - Register via `/auth/register` → returns access token.  
  - Login via `/auth/login` with username + password → backend resolves username → email, then uses Supabase Auth sign-in.  
  - Store access token in frontend (e.g. memory + httpOnly cookie or local storage depending on threat model).  
- For each API call:
  - Include `Authorization: Bearer <access_token>` header.

### 3.2 Authorization & Data Isolation

- Database-level enforcement:
  - `public.profiles` RLS: `id = auth.uid()` for SELECT/UPDATE/INSERT.  
  - `public.cards` RLS: `owner_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE.  
- API-level:
  - No cross-user parameters (no `owner_id` in payloads; always derived from `auth.uid()`).  
  - Any attempt to access another user’s data results in `404 Not Found` (due to RLS) or `403` if caught earlier in custom logic.

### 3.3 Session Expiry Handling

- Expired / invalid JWT → `401 Unauthorized`.  
- Frontend reacts by redirecting to login and showing session expired message, then restarts main flow.

### 3.4 Rate Limiting and Abuse Protection

- Recommended:  
  - Apply per-IP and per-user rate limits for:
    - `/ai/generate` (protect AI costs).  
    - `/ai/cards/batch` (mitigate massive batch writes).  
    - `/auth/*` (mitigate brute force).
  - Example budgets:
    - `/ai/generate`: 10–20 calls per user per hour.  
    - `/auth/login`: exponential backoff on failed attempts.

---

## 4. Validation and Business Logic

### 4.1 Profiles

**Fields**

- `username: string`

**Validation Rules**

- Required on registration, optional but validated on update.  
- Must be non-empty after trimming (`length(btrim(username)) > 0`).  
- Optional recommended: `3 <= char_length(username) <= 32`.  
- Optional regex: `username ~ '^[A-Za-z0-9_\\.]+$'`.  
- `lower(username)` must be unique (`profiles_username_lower_ux`).

**Business Logic**

- On registration:
  - Create `auth.users` entry via Supabase.  
  - Immediately insert `profiles` row with matching `id`.  
- On update:
  - Only current user can change own username.  
  - Conflict with existing `username` → `409 Conflict`.

---

### 4.2 Cards

**Fields**

- `front: string` – required.  
- `back: string` – required.  
- `source_snippet: string` – required, non-empty, may be `"Brak"` if user has no better source.  
- `origin: "manual" | "ai"` – optional in request; enforced by API:
  - `POST /cards` → `"manual"`.  
  - `POST /ai/cards/batch` → `"ai"`.
- SM‑2 metadata (managed in study):
  - `ease_factor: number` – default 2.5; must be between 1.3 and 3.0.  
  - `interval_days: integer` – >= 0.  
  - `repetitions: integer` – >= 0.  
  - `due_at: timestamptz` – default `now()`.  
  - `last_reviewed_at: timestamptz | null`.

**Validation Rules**

On **Create**:

- `front`, `back`, `source_snippet`: required, trim and verify `length > 0`.  
- Optional length caps: e.g. `front <= 10000`, `back <= 10000`, `source_snippet <= 20000` (align with DB if added).  
- `origin` not accepted from client; server sets it.

On **Update** (`PATCH /cards/{id}`):

- If any of `front`, `back`, `source_snippet` present:
  - Must be non-empty after trim.  
- No direct modification of SM‑2 fields; they are owned by SM‑2 business logic.

**Business Logic**

- Ownership:
  - `owner_id = auth.uid()` set on insert (server-side).  
  - RLS ensures only owner can see/update/delete.
- Hard delete:
  - `DELETE /cards/{id}` physically removes row (`ON DELETE CASCADE` for related `card_reviews` if used).

---

### 4.3 AI Generation

**Endpoints**

- `/ai/generate` – generate preview, no DB write.  
- `/ai/cards/batch` – transactional save of generated cards.

**Validation Rules**

- `input_text` in `/ai/generate`:
  - Required, non-empty after trim.  
  - Technical character limit; above this return `413 Payload Too Large` with helpful message.
- Per-card fields in `/ai/cards/batch`:
  - `front`, `back`, `source_snippet`: required, non-empty after trim.  
  - Optional length caps consistent with cards table.
- `cards` array must contain at least one item; otherwise `400`.

**Business Logic**

- `/ai/generate`:
  - Only uses OpenRouter models; does not persist anything.  
  - Model is instructed to:
    - Generate only Basic cards (front/back).  
    - Attach `source_snippet` cut from user-provided text.  
    - Avoid hallucinating content not backed by input.
  - UI shows standard warning: “Verify with source; AI can be wrong”.
- `/ai/cards/batch`:
  - Enforced `origin = "ai"`.  
  - Transactional (all-or-nothing).  
  - User can discard proposals client-side without calling API.  
- Instrumentation:
  - Log events like `AI_generate_requested`, `AI_generate_succeeded/failed`, `AI_cards_generated_count`, `AI_cards_saved_count`.

---

### 4.4 Study / SM‑2

**SM‑2 Core Data per Card**

- `ease_factor: numeric(4,2)` – default 2.50; constrained `[1.30, 3.00]`.  
- `interval_days: integer` – >= 0.  
- `repetitions: integer` – >= 0.  
- `due_at: timestamptz` – next review time.  
- `last_reviewed_at: timestamptz` – last review time.

**Validation Rules (`/study/review`)**

- `grade` in `[0, 5]`, integer.  
- `card_id` must be non-null UUID; card must exist and be owned by current user.  
- Review must not break DB constraints (e.g. `ease_factor` out of range).

**Business Logic**

- **Get due cards**:
  - `GET /study/due-cards` selects `WHERE owner_id = auth.uid() AND due_at <= now()` ordered by `(due_at, id)` with limit.  
  - If empty, frontend shows “No cards to review” and CTA to list or AI generation.
- **Review**:
  - Compute next SM‑2 parameters based on grade:
    - Grade < 3:  
      - `repetitions = 0` (or 1; choose consistent variant).  
      - `interval_days = 1`.  
      - Decrease `ease_factor` (typical formula `EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))`), then clamp `[1.3, 3.0]`.
    - Grade ≥ 3:  
      - `repetitions += 1`.  
      - If `repetitions == 1`: `interval_days = 1`.  
      - If `repetitions == 2`: `interval_days = 6`.  
      - Else: `interval_days = round(interval_days * ease_factor)`.  
      - Update `ease_factor` according to same formula and clamp.
  - Set `last_reviewed_at = now()`.  
  - Set `due_at = now() + interval_days`.  
  - Optional: write `card_reviews` record with `grade` and `reviewed_at`.  
- **Edge Cases**:
  - If card is already due in far future but user still reviews it, algorithm works normally (rare case).  
  - If DB constraints triggered (e.g. due to incorrect implementation), API returns `422` with message.

---

### 4.5 Non-Functional Requirements

**Availability**

- All critical endpoints (auth, cards, AI, study) should support basic keyboard accessibility via predictable JSON error formats and no side effects on GET.  
- Client-side handles empty states and errors gracefully.

**Security**

- Passwords are only managed by Supabase Auth; no custom password columns in app DB.  
- No public exposure of domain tables for anonymous users.  
- RLS ensures strict user isolation.  
- For logging/analytics, store only non-sensitive events; avoid logging full card content where not needed.

**Reliability and Data Integrity**

- Batch save for AI uses explicit transaction to avoid partial insert.  
- Manual card create/update/delete should handle DB errors and surface them clearly to user (e.g. network failure, constraint violation).  
- Frontend warns user when leaving AI result screen with unsaved proposals (client-side only; no special endpoint).

**Performance**

- Use defined indices:
  - `cards_owner_due_id_ix` for due cards.  
  - `cards_owner_created_id_ix` for list views.  
- Pagination on list endpoints (`/cards`, `/study/due-cards`).  
- For very long `input_text` in AI, use streaming to OpenRouter if supported and safe, or enforce sane length.

---
