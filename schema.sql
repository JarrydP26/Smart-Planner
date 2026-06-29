-- ════════════════════════════════════════════════════════
-- GRADE 3 PLANNER — DATABASE SCHEMA (Phase 1)
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════

-- 1. PLANNERS
-- Each "Class Planner" is its own workspace. Starts blank — no timetable,
-- no weeks — until someone fills in Timetable Setup.
create table if not exists planners (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Class Planner',
  school_name text default '',
  class_name text default '',
  term_weeks int default 10,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 2. PLANNER MEMBERS
-- Links users to planners. A user can belong to multiple planners
-- (e.g. their own, plus a shared Maths one). Supports the 3-teacher share.
create table if not exists planner_members (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid references planners(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'editor', -- 'owner' | 'editor' (room for future permission levels)
  joined_at timestamptz default now(),
  unique(planner_id, user_id)
);

-- 3. PLANNER DATA
-- One row per planner, holding all its app state as JSON — same shape as
-- the localStorage blob the HTML version used (weeks, appSettings, etc).
-- Keeping this as one JSON blob per planner means we don't need to redesign
-- every internal data structure right now — Phase 2 ports the existing
-- shape almost as-is, just reading/writing here instead of localStorage.
create table if not exists planner_data (
  planner_id uuid primary key references planners(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 4. PLANNER INVITES
-- Pending invites by email, for people who haven't signed up yet or
-- haven't accepted. Resolved into planner_members once accepted.
create table if not exists planner_invites (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid references planners(id) on delete cascade not null,
  email text not null,
  invited_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  status text default 'pending' -- 'pending' | 'accepted' | 'declined'
);

-- ════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ensures each planner's data is only
-- visible/editable by its members. This is the core privacy guarantee.
-- ════════════════════════════════════════════════════════

alter table planners enable row level security;
alter table planner_members enable row level security;
alter table planner_data enable row level security;
alter table planner_invites enable row level security;

-- Helper: is the current logged-in user a member of this planner?
create or replace function is_planner_member(p_planner_id uuid)
returns boolean as $$
  select exists (
    select 1 from planner_members
    where planner_id = p_planner_id and user_id = auth.uid()
  );
$$ language sql security definer;

-- Planners: members can view; only the owner can update planner-level settings
create policy "Members can view their planners"
  on planners for select
  using (is_planner_member(id));

create policy "Owner can update planner"
  on planners for update
  using (owner_id = auth.uid());

create policy "Authenticated users can create planners"
  on planners for insert
  with check (auth.uid() = owner_id);

-- Planner members: members can see who else is on their planner
create policy "Members can view planner membership"
  on planner_members for select
  using (is_planner_member(planner_id));

create policy "Owner can add members"
  on planner_members for insert
  with check (
    exists (select 1 from planners where id = planner_id and owner_id = auth.uid())
    or user_id = auth.uid() -- allow accepting your own invite
  );

create policy "Owner can remove members"
  on planner_members for delete
  using (
    exists (select 1 from planners where id = planner_id and owner_id = auth.uid())
  );

-- Planner data: any member can read and write (matches the "shared editing" model)
create policy "Members can view planner data"
  on planner_data for select
  using (is_planner_member(planner_id));

create policy "Members can update planner data"
  on planner_data for update
  using (is_planner_member(planner_id));

create policy "Members can insert planner data"
  on planner_data for insert
  with check (is_planner_member(planner_id));

-- Invites: planner members can view/create invites for their planner;
-- anyone can view an invite addressed to their own email (to accept it)
create policy "Members can view invites for their planner"
  on planner_invites for select
  using (is_planner_member(planner_id) or email = auth.jwt()->>'email');

create policy "Members can create invites"
  on planner_invites for insert
  with check (is_planner_member(planner_id));

create policy "Invited user can update their own invite status"
  on planner_invites for update
  using (email = auth.jwt()->>'email');

-- ════════════════════════════════════════════════════════
-- AUTO-SETUP: when a new planner is created, automatically add the
-- creator as a member with role 'owner', and create its blank data row.
-- ════════════════════════════════════════════════════════

create or replace function handle_new_planner()
returns trigger as $$
begin
  insert into planner_members (planner_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into planner_data (planner_id, data)
  values (new.id, '{}'::jsonb);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_planner_created
  after insert on planners
  for each row execute function handle_new_planner();
