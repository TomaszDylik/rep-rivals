-- ============================================================
-- Rep Rivals — Full PostgreSQL Schema
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Users (mirrors Supabase Auth, stores public profile data)
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  username   text unique not null,
  created_at timestamptz default now()
);

-- Groups
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.users(id) on delete cascade,
  name        text not null,
  invite_code text unique not null default '',
  created_at  timestamptz default now()
);

-- Group Members (junction)
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Categories (per group, with metric flags)
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  name         text not null,
  has_reps     boolean default false,
  has_weight   boolean default false,
  has_distance boolean default false,
  has_time     boolean default false
);

-- Workouts
create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);

-- Exercises (belong to a workout)
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  custom_name text not null
);

-- Sets (belong to an exercise)
create table public.sets (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  reps        int,
  weight_kg   real,
  distance_km real,
  time_min    int
);

-- Reaction type enum
create type public.reaction_type as enum ('muscle', 'heart', 'fire');

-- Reactions (one per user per workout)
create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  type       public.reaction_type not null,
  unique (workout_id, user_id)
);

-- Comments
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. INVITE CODE TRIGGER  (6-char alphanumeric on group create)
-- ============================================================

create or replace function public.generate_invite_code()
returns trigger as $$
declare
  new_code text;
  exists_already boolean;
begin
  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    select exists(select 1 from public.groups where invite_code = new_code) into exists_already;
    exit when not exists_already;
  end loop;
  new.invite_code := new_code;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_invite_code
  before insert on public.groups
  for each row
  execute function public.generate_invite_code();

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

-- Helper: is caller a member of the given group?
create or replace function public.is_member(gid uuid)
returns boolean as $$
  select exists(
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper: is caller the admin of the given group?
create or replace function public.is_admin(gid uuid)
returns boolean as $$
  select exists(
    select 1 from public.groups
    where id = gid and admin_id = auth.uid()
  );
$$ language sql security definer;

-- ---- USERS ----
alter table public.users enable row level security;

create policy "Users can read any profile"
  on public.users for select
  using (true);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- ---- GROUPS ----
alter table public.groups enable row level security;

create policy "Members can view their groups"
  on public.groups for select
  using (public.is_member(id) or admin_id = auth.uid());

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = admin_id);

create policy "Admin can update group"
  on public.groups for update
  using (admin_id = auth.uid());

create policy "Admin can delete group"
  on public.groups for delete
  using (admin_id = auth.uid());

-- ---- GROUP MEMBERS ----
alter table public.group_members enable row level security;

create policy "Members can view group roster"
  on public.group_members for select
  using (public.is_member(group_id));

create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave or admin can kick"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or public.is_admin(group_id)
  );

-- ---- CATEGORIES ----
alter table public.categories enable row level security;

create policy "Members can view categories"
  on public.categories for select
  using (public.is_member(group_id));

create policy "Admin can create categories"
  on public.categories for insert
  with check (public.is_admin(group_id));

create policy "Admin can update categories"
  on public.categories for update
  using (public.is_admin(group_id));

create policy "Admin can delete categories"
  on public.categories for delete
  using (public.is_admin(group_id));

-- ---- WORKOUTS ----
alter table public.workouts enable row level security;

create policy "Members can view group workouts"
  on public.workouts for select
  using (public.is_member(group_id));

create policy "Members can create workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id and public.is_member(group_id));

create policy "Owner can update workout"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Owner can delete workout"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- ---- EXERCISES ----
alter table public.exercises enable row level security;

create policy "Can view exercises of visible workouts"
  on public.exercises for select
  using (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and public.is_member(w.group_id)
    )
  );

create policy "Workout owner can insert exercises"
  on public.exercises for insert
  with check (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create policy "Workout owner can update exercises"
  on public.exercises for update
  using (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create policy "Workout owner can delete exercises"
  on public.exercises for delete
  using (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- ---- SETS ----
alter table public.sets enable row level security;

create policy "Can view sets of visible exercises"
  on public.sets for select
  using (
    exists(
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and public.is_member(w.group_id)
    )
  );

create policy "Workout owner can insert sets"
  on public.sets for insert
  with check (
    exists(
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and w.user_id = auth.uid()
    )
  );

create policy "Workout owner can update sets"
  on public.sets for update
  using (
    exists(
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and w.user_id = auth.uid()
    )
  );

create policy "Workout owner can delete sets"
  on public.sets for delete
  using (
    exists(
      select 1 from public.exercises e
      join public.workouts w on w.id = e.workout_id
      where e.id = exercise_id and w.user_id = auth.uid()
    )
  );

-- ---- REACTIONS ----
alter table public.reactions enable row level security;

create policy "Members can view reactions"
  on public.reactions for select
  using (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and public.is_member(w.group_id)
    )
  );

create policy "Members can add reactions"
  on public.reactions for insert
  with check (
    auth.uid() = user_id
    and exists(
      select 1 from public.workouts w
      where w.id = workout_id and public.is_member(w.group_id)
    )
  );

create policy "User can remove own reaction"
  on public.reactions for delete
  using (auth.uid() = user_id);

-- ---- COMMENTS ----
alter table public.comments enable row level security;

create policy "Members can view comments"
  on public.comments for select
  using (
    exists(
      select 1 from public.workouts w
      where w.id = workout_id and public.is_member(w.group_id)
    )
  );

create policy "Members can add comments"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists(
      select 1 from public.workouts w
      where w.id = workout_id and public.is_member(w.group_id)
    )
  );

create policy "User can update own comments"
  on public.comments for update
  using (auth.uid() = user_id);

create policy "User can delete own comments"
  on public.comments for delete
  using (auth.uid() = user_id);
