/*
 * migration: create insert_cards_batch function
 * description: creates rpc function for atomic batch insertion of ai-generated cards
 * affected tables: public.cards
 * notes:
 *   - ensures atomicity: all cards inserted in single transaction or none
 *   - enforces owner_id = auth.uid() (security: ignores owner_id from payload)
 *   - automatically sets origin = 'ai' for all cards in batch
 *   - validates required fields (front, back, source_snippet not empty)
 *   - returns array of created card ids for client confirmation
 */

-- create function for atomic batch card insertion
create or replace function public.insert_cards_batch(cards jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_ids uuid[];
  user_id uuid;
begin
  -- get authenticated user id
  user_id := auth.uid();
  
  -- security check: ensure user is authenticated
  if user_id is null then
    raise exception 'authentication required: must be logged in to insert cards';
  end if;
  
  -- validate input: cards must be a json array
  if jsonb_typeof(cards) != 'array' then
    raise exception 'invalid input: cards parameter must be a json array';
  end if;
  
  -- validate input: array cannot be empty
  if jsonb_array_length(cards) = 0 then
    raise exception 'invalid input: cards array cannot be empty';
  end if;
  
  -- insert cards batch atomically
  -- security: owner_id is forced to auth.uid(), ignoring any owner_id in payload
  -- origin is forced to 'ai' for all cards in this batch
  -- validation: front, back, source_snippet must not be empty or whitespace-only
  with inserted as (
    insert into public.cards (
      owner_id,
      origin,
      front,
      back,
      source_snippet
    )
    select
      user_id,
      'ai',
      btrim(card->>'front'),
      btrim(card->>'back'),
      btrim(card->>'source_snippet')
    from jsonb_array_elements(cards) as card
    -- validate required fields are present and not empty after trimming
    where length(btrim(card->>'front')) > 0
      and length(btrim(card->>'back')) > 0
      and length(btrim(card->>'source_snippet')) > 0
    returning id
  )
  select array_agg(id) into inserted_ids from inserted;
  
  -- validate that all cards were inserted
  -- if counts don't match, some cards failed validation
  if array_length(inserted_ids, 1) != jsonb_array_length(cards) then
    raise exception 'validation error: some cards have empty or invalid required fields (front, back, or source_snippet)';
  end if;
  
  -- return array of created card ids
  return inserted_ids;
end;
$$;

comment on function public.insert_cards_batch(jsonb) is 'atomically inserts batch of ai-generated cards, enforces owner_id = auth.uid() and validates required fields';

-- grant execute permission to authenticated users
grant execute on function public.insert_cards_batch(jsonb) to authenticated;

-- example usage:
-- select public.insert_cards_batch('[
--   {
--     "front": "What is the capital of France?",
--     "back": "Paris",
--     "source_snippet": "France, officially the French Republic, is a country whose capital is Paris."
--   },
--   {
--     "front": "What is 2+2?",
--     "back": "4",
--     "source_snippet": "Basic arithmetic: 2+2=4"
--   }
-- ]'::jsonb);