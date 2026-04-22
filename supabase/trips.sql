-- MotoTrack — multi-session trips.
-- A trip groups multiple ride sessions together (e.g. a 5-session Ladakh tour).
-- Run this ONCE in the Supabase SQL editor AFTER schema.sql.
-- Safe to re-run — all statements are idempotent.

create table if not exists public.trips (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  cover_color  text not null default 'sunrise',
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists trips_user_idx on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;

drop policy if exists "owner can read trips"   on public.trips;
drop policy if exists "owner can insert trips" on public.trips;
drop policy if exists "owner can update trips" on public.trips;
drop policy if exists "owner can delete trips" on public.trips;

create policy "owner can read trips"   on public.trips for select using  (auth.uid() = user_id);
create policy "owner can insert trips" on public.trips for insert with check (auth.uid() = user_id);
create policy "owner can update trips" on public.trips for update using  (auth.uid() = user_id);
create policy "owner can delete trips" on public.trips for delete using  (auth.uid() = user_id);

-- Add trip_id to rides so a ride can belong to at most one trip.
-- Deleting a trip nulls out the link — the underlying rides remain.
alter table public.rides
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists rides_trip_idx on public.rides (trip_id);
