-- MotoTrack Supabase schema + RLS.
-- Run this ONCE in the Supabase SQL editor after creating the project.
-- Dashboard → SQL Editor → New query → paste this → Run.
-- Safe to re-run — all statements are idempotent.

create table if not exists public.rides (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  device_id   text not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  stats       jsonb not null,
  track       jsonb not null,
  name        text,
  bike_id     uuid,
  created_at  timestamptz not null default now()
);

alter table public.rides add column if not exists name text;
alter table public.rides add column if not exists bike_id uuid;

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

-- Bikes: per-user garage. A ride may reference bike_id (nullable).
create table if not exists public.bikes (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists bikes_user_idx on public.bikes (user_id, created_at);

alter table public.bikes enable row level security;

drop policy if exists "owner can read bikes"   on public.bikes;
drop policy if exists "owner can insert bikes" on public.bikes;
drop policy if exists "owner can update bikes" on public.bikes;
drop policy if exists "owner can delete bikes" on public.bikes;

create policy "owner can read bikes"   on public.bikes for select using  (auth.uid() = user_id);
create policy "owner can insert bikes" on public.bikes for insert with check (auth.uid() = user_id);
create policy "owner can update bikes" on public.bikes for update using  (auth.uid() = user_id);
create policy "owner can delete bikes" on public.bikes for delete using  (auth.uid() = user_id);
