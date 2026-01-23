/*
 * migration: create cards table
 * description: creates public.cards table with sm-2 algorithm state and rls policies
 * affected tables: public.cards
 * notes:
 *   - stores flashcard content (front/back/source_snippet)
 *   - includes sm-2 spaced repetition state (ease_factor, interval_days, repetitions)
 *   - origin field tracks manual vs ai creation for metrics
 *   - comprehensive validation constraints on all fields
 *   - optimized indexes for due card selection and card listing
 */

-- create cards table
create table public.cards (
  -- primary key using uuid v4
  id uuid primary key default gen_random_uuid(),
  
  -- foreign key to owner (auth.users)
  -- cascading delete removes all user's cards when account is deleted
  owner_id uuid not null references auth.users(id) on delete cascade,
  
  -- origin tracking for metrics (manual creation vs ai generation)
  origin text not null default 'manual',
  
  -- flashcard content fields
  front text not null,
  back text not null,
  source_snippet text not null,
  
  -- sm-2 spaced repetition algorithm state
  -- ease_factor: difficulty rating, range 1.30-3.00, default 2.50
  ease_factor numeric(4,2) not null default 2.50,
  
  -- interval_days: days until next review, starts at 0 for new cards
  interval_days integer not null default 0,
  
  -- repetitions: count of successful reviews, starts at 0
  repetitions integer not null default 0,
  
  -- due_at: timestamp when card is due for review
  -- default now() treats new cards as immediately due
  due_at timestamptz not null default now(),
  
  -- last_reviewed_at: timestamp of most recent review (null for new cards)
  last_reviewed_at timestamptz,
  
  -- timestamp tracking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- validation constraints
  -- origin must be either 'manual' or 'ai'
  constraint origin_valid check (origin in ('manual', 'ai')),
  
  -- ensure front text is not empty or whitespace-only
  constraint front_not_empty check (length(btrim(front)) > 0),
  
  -- ensure back text is not empty or whitespace-only
  constraint back_not_empty check (length(btrim(back)) > 0),
  
  -- ensure source_snippet is not empty or whitespace-only (critical per prd)
  constraint source_snippet_not_empty check (length(btrim(source_snippet)) > 0),
  
  -- sm-2 algorithm constraints
  -- ease_factor must be within valid sm-2 range
  constraint ease_factor_range check (ease_factor >= 1.30 and ease_factor <= 3.00),
  
  -- interval_days cannot be negative
  constraint interval_days_non_negative check (interval_days >= 0),
  
  -- repetitions cannot be negative
  constraint repetitions_non_negative check (repetitions >= 0),
  
  -- optional technical limits to prevent abuse (safe defaults)
  -- front text limited to 10000 characters
  constraint front_length check (char_length(front) <= 10000),
  
  -- back text limited to 10000 characters
  constraint back_length check (char_length(back) <= 10000),
  
  -- source_snippet limited to 50000 characters (can be longer as it's reference material)
  constraint source_snippet_length check (char_length(source_snippet) <= 50000)
);

comment on table public.cards is 'flashcards with sm-2 spaced repetition state, supports manual and ai-generated cards';
comment on column public.cards.id is 'unique card identifier (uuid v4)';
comment on column public.cards.owner_id is 'user who owns this card (references auth.users)';
comment on column public.cards.origin is 'creation source: manual (user-created) or ai (ai-generated)';
comment on column public.cards.front is 'front side of flashcard (question/prompt)';
comment on column public.cards.back is 'back side of flashcard (answer)';
comment on column public.cards.source_snippet is 'source material excerpt (required, cannot be empty)';
comment on column public.cards.ease_factor is 'sm-2 ease factor (difficulty rating), range 1.30-3.00';
comment on column public.cards.interval_days is 'sm-2 interval in days until next review';
comment on column public.cards.repetitions is 'sm-2 count of successful reviews';
comment on column public.cards.due_at is 'timestamp when card is due for review (utc)';
comment on column public.cards.last_reviewed_at is 'timestamp of most recent review, null for new cards (utc)';
comment on column public.cards.created_at is 'timestamp when card was created (utc)';
comment on column public.cards.updated_at is 'timestamp when card was last updated (utc), maintained by trigger';

-- create trigger to automatically update updated_at timestamp
create trigger set_cards_updated_at
  before update on public.cards
  for each row
  execute function public.set_updated_at();

comment on trigger set_cards_updated_at on public.cards is 'automatically updates updated_at column on card modification';

-- performance indexes
-- index for selecting due cards (critical path for review session)
-- composite index on (owner_id, due_at, id) supports filtering and stable sorting
-- supports queries: where owner_id = auth.uid() and due_at <= now() order by due_at, id
create index cards_owner_due_id_ix on public.cards (owner_id, due_at, id);

comment on index cards_owner_due_id_ix is 'optimizes selection of due cards for review sessions with stable sorting';

-- index for listing user's cards by creation date (card management view)
-- composite index on (owner_id, created_at desc, id) supports filtering and sorting
-- supports queries: where owner_id = auth.uid() order by created_at desc, id
create index cards_owner_created_id_ix on public.cards (owner_id, created_at desc, id);

comment on index cards_owner_created_id_ix is 'optimizes listing user cards by creation date (newest first)';

-- enable row level security
alter table public.cards enable row level security;

-- rls policy: authenticated users can view their own cards
create policy cards_select_own
  on public.cards
  for select
  to authenticated
  using (owner_id = auth.uid());

comment on policy cards_select_own on public.cards is 'allows authenticated users to view only their own cards';

-- rls policy: authenticated users can insert their own cards
-- with check ensures owner_id matches authenticated user
create policy cards_insert_own
  on public.cards
  for insert
  to authenticated
  with check (owner_id = auth.uid());

comment on policy cards_insert_own on public.cards is 'allows authenticated users to create cards (owner_id must match auth.uid())';

-- rls policy: authenticated users can update their own cards
-- using clause restricts which rows can be selected for update
-- with check clause validates updated data (owner_id immutable)
create policy cards_update_own
  on public.cards
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

comment on policy cards_update_own on public.cards is 'allows authenticated users to update only their own cards (owner_id immutable)';

-- rls policy: authenticated users can delete their own cards
-- hard delete (no soft delete in mvp)
create policy cards_delete_own
  on public.cards
  for delete
  to authenticated
  using (owner_id = auth.uid());

comment on policy cards_delete_own on public.cards is 'allows authenticated users to delete only their own cards (hard delete)';