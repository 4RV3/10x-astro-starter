/*
 * migration: create profiles table
 * description: creates public.profiles table with username normalization and rls policies
 * affected tables: public.profiles
 * notes:
 *   - profiles table has 1:1 relationship with auth.users
 *   - username is normalized using lower() for case-insensitive uniqueness
 *   - includes trigger for automatic updated_at timestamp management
 */

-- create reusable function for updating updated_at timestamp
-- this function will be used by triggers on multiple tables
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- automatically set updated_at to current timestamp on row update
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'trigger function to automatically update updated_at column on row modification';

-- create profiles table
create table public.profiles (
  -- primary key that references auth.users (1:1 relationship)
  -- cascading delete ensures profile is removed when user account is deleted
  id uuid primary key references auth.users(id) on delete cascade,
  
  -- username with validation constraints
  username text not null,
  
  -- timestamp tracking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- validation constraints
  -- ensure username is not empty or whitespace-only
  constraint username_not_empty check (length(btrim(username)) > 0),
  
  -- enforce reasonable username length (3-32 characters)
  constraint username_length check (char_length(username) between 3 and 32),
  
  -- restrict username to alphanumeric characters, underscores, and dots
  -- this pattern allows: letters (a-z, A-Z), digits (0-9), underscore (_), and dot (.)
  constraint username_pattern check (username ~ '^[A-Za-z0-9_\.]+$')
);

comment on table public.profiles is 'user profile data with 1:1 relationship to auth.users';
comment on column public.profiles.id is 'user id from auth.users, serves as both pk and fk';
comment on column public.profiles.username is 'unique username, case-insensitive, alphanumeric with underscore and dot';
comment on column public.profiles.created_at is 'timestamp when profile was created (utc)';
comment on column public.profiles.updated_at is 'timestamp when profile was last updated (utc), maintained by trigger';

-- create unique index on normalized (lowercase) username
-- this ensures case-insensitive uniqueness without using citext extension
create unique index profiles_username_lower_ux on public.profiles (lower(username));

comment on index profiles_username_lower_ux is 'ensures case-insensitive username uniqueness using lower() normalization';

-- create trigger to automatically update updated_at timestamp
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

comment on trigger set_profiles_updated_at on public.profiles is 'automatically updates updated_at column on profile modification';

-- enable row level security
alter table public.profiles enable row level security;

-- rls policy: authenticated users can view their own profile
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

comment on policy profiles_select_own on public.profiles is 'allows authenticated users to view only their own profile';

-- rls policy: authenticated users can insert their own profile
-- the with check ensures that the inserted id matches the authenticated user's id
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

comment on policy profiles_insert_own on public.profiles is 'allows authenticated users to create only their own profile (id must match auth.uid())';

-- rls policy: authenticated users can update their own profile
-- using clause restricts which rows can be selected for update
-- with check clause validates the updated data (id cannot be changed)
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

comment on policy profiles_update_own on public.profiles is 'allows authenticated users to update only their own profile (id immutable)';

-- note: no delete policy
-- profile deletion should happen through auth.users deletion (cascading)
-- this prevents accidental profile deletion while keeping auth account