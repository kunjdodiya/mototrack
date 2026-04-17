-- MotoTrack Supabase schema + RLS.
-- Run this ONCE in the Supabase SQL editor after creating the project.
-- Dashboard → SQL Editor → New query → paste this → Run.

create table if not exists public.rides (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  device_id   text not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  stats       jsonb not null,
  track       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists rides_user_started_idx on public.rides (user_id, started_at desc);

alter table public.rides enable row level security;

drop policy if exists "owner can read"   on public.rides;
drop policy if exists "owner can insert" on public.rides;
drop policy if exists "owner can update" on public.rides;
drop policy if exists "owner can delete" on public.rides;

create policy "owner can read"   on public.rides for select using  (auth.uid() = user_id);
create policy "owner can insert" on public.rides for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.rides for update using  (auth.uid() = user_id);
create policy "owner can delete" on public.rides for delete using  (auth.uid() = user_id);
