create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  apple_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_local_id text not null,
  local_id text not null,
  name text not null,
  position integer not null,
  target_sets integer not null,
  target_reps integer,
  weight_lb integer,
  rest_seconds integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plan_local_id, local_id)
);

create table if not exists public.workout_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  plan_local_id text not null,
  name text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  total_sets integer not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.daily_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  date text not null,
  title text not null,
  kind text not null default 'task',
  workout_plan_local_id text,
  position integer not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.step_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null,
  steps integer not null,
  source text not null default 'health',
  created_at timestamptz not null default now(),
  unique(user_id, captured_at)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_outcomes enable row level security;
alter table public.daily_plans enable row level security;
alter table public.daily_items enable row level security;
alter table public.step_samples enable row level security;
alter table public.notification_preferences enable row level security;

create policy "profiles owner access" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "workout plans owner access" on public.workout_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workout exercises owner access" on public.workout_exercises
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workout outcomes owner access" on public.workout_outcomes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily plans owner access" on public.daily_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily items owner access" on public.daily_items
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "step samples owner access" on public.step_samples
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notification prefs owner access" on public.notification_preferences
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
