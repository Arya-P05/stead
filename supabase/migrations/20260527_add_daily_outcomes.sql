create table if not exists public.daily_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  completed_items integer not null,
  planned_items integer not null,
  steps integer not null,
  focus_minutes integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table public.daily_outcomes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_outcomes'
      and policyname = 'daily outcomes owner access'
  ) then
    create policy "daily outcomes owner access" on public.daily_outcomes
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
