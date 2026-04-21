-- MotoTrack community schema: clubs, memberships, events, RSVPs.
-- Run this ONCE in the Supabase SQL editor after creating the project
-- (or any time you want to upgrade an existing project to the community
-- feature). Safe to re-run — every statement is idempotent.
--
-- Dashboard → SQL Editor → New query → paste → Run.

-- ---------------------------------------------------------------------------
-- clubs: one row per motorcycle club. Anyone signed in can browse and create.
-- Only the owner (created_by) can edit or delete.
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id            uuid primary key,
  name          text not null check (char_length(name) between 1 and 60),
  description   text check (char_length(description) <= 500),
  city          text check (char_length(city) <= 80),
  accent        text not null default 'sunrise'
                check (accent in ('sunrise', 'neon', 'ocean', 'aurora', 'ember')),
  created_by    uuid not null references auth.users(id) on delete cascade,
  member_count  int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists clubs_created_by_idx on public.clubs (created_by);
create index if not exists clubs_created_at_idx on public.clubs (created_at desc);

alter table public.clubs enable row level security;

drop policy if exists "clubs readable by authenticated" on public.clubs;
drop policy if exists "clubs insert by owner"          on public.clubs;
drop policy if exists "clubs update by owner"          on public.clubs;
drop policy if exists "clubs delete by owner"          on public.clubs;

create policy "clubs readable by authenticated"
  on public.clubs for select
  using (auth.role() = 'authenticated');

create policy "clubs insert by owner"
  on public.clubs for insert
  with check (auth.uid() = created_by);

create policy "clubs update by owner"
  on public.clubs for update
  using (auth.uid() = created_by);

create policy "clubs delete by owner"
  on public.clubs for delete
  using (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- club_members: who has joined which club. Open-join: user adds their own
-- row to join, deletes it to leave. Club owner can also kick a member.
-- ---------------------------------------------------------------------------
create table if not exists public.club_members (
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id, joined_at desc);

alter table public.club_members enable row level security;

drop policy if exists "members read own"          on public.club_members;
drop policy if exists "members self-join"         on public.club_members;
drop policy if exists "members self-leave"        on public.club_members;
drop policy if exists "members owner can remove"  on public.club_members;

-- Users only see their own membership rows — aggregate member counts come
-- from the denormalised `clubs.member_count` column (maintained by trigger
-- below). We deliberately don't expose per-user membership rosters in MVP
-- to avoid leaking user_ids.
create policy "members read own"
  on public.club_members for select
  using (user_id = auth.uid());

create policy "members self-join"
  on public.club_members for insert
  with check (user_id = auth.uid());

create policy "members self-leave"
  on public.club_members for delete
  using (user_id = auth.uid());

create policy "members owner can remove"
  on public.club_members for delete
  using (
    exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id and c.created_by = auth.uid()
    )
  );

-- Trigger-maintained member_count. Keeps the aggregate on `clubs` in sync
-- so the browse list can order by popularity without exposing the roster.
create or replace function public.club_members_count_tick()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.clubs set member_count = member_count + 1 where id = new.club_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.clubs set member_count = greatest(member_count - 1, 0) where id = old.club_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists club_members_count_tick on public.club_members;
create trigger club_members_count_tick
after insert or delete on public.club_members
for each row execute function public.club_members_count_tick();

-- ---------------------------------------------------------------------------
-- club_events: a ride/meet-up hosted by a club. Visible to any signed-in
-- user (for discovery); only club members can create; only the creator or
-- club owner can edit/delete.
-- ---------------------------------------------------------------------------
create table if not exists public.club_events (
  id            uuid primary key,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 80),
  description   text check (char_length(description) <= 500),
  start_at      timestamptz not null,
  meet_label    text check (char_length(meet_label) <= 120),
  meet_lat      double precision,
  meet_lng      double precision,
  created_by    uuid not null references auth.users(id) on delete cascade,
  going_count   int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists club_events_club_idx       on public.club_events (club_id, start_at);
create index if not exists club_events_start_at_idx   on public.club_events (start_at);
create index if not exists club_events_created_by_idx on public.club_events (created_by);

alter table public.club_events enable row level security;

drop policy if exists "events readable by authenticated" on public.club_events;
drop policy if exists "events insert by member"          on public.club_events;
drop policy if exists "events update by creator"         on public.club_events;
drop policy if exists "events delete by creator"         on public.club_events;
drop policy if exists "events delete by club owner"      on public.club_events;

create policy "events readable by authenticated"
  on public.club_events for select
  using (auth.role() = 'authenticated');

create policy "events insert by member"
  on public.club_events for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.club_members m
      where m.club_id = club_events.club_id and m.user_id = auth.uid()
    )
  );

create policy "events update by creator"
  on public.club_events for update
  using (created_by = auth.uid());

create policy "events delete by creator"
  on public.club_events for delete
  using (created_by = auth.uid());

create policy "events delete by club owner"
  on public.club_events for delete
  using (
    exists (
      select 1 from public.clubs c
      where c.id = club_events.club_id and c.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- event_rsvps: going / maybe / no. One row per (event, user); upsert to flip.
-- Any signed-in user can read (needed so the app can show "going" counts
-- independently of the maintained `going_count`); only the user themselves
-- can upsert their own row.
-- ---------------------------------------------------------------------------
create table if not exists public.event_rsvps (
  event_id    uuid not null references public.club_events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null check (status in ('going', 'maybe', 'no')),
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_rsvps_user_idx on public.event_rsvps (user_id, updated_at desc);

alter table public.event_rsvps enable row level security;

drop policy if exists "rsvps readable by authenticated" on public.event_rsvps;
drop policy if exists "rsvps insert self"               on public.event_rsvps;
drop policy if exists "rsvps update self"               on public.event_rsvps;
drop policy if exists "rsvps delete self"               on public.event_rsvps;

create policy "rsvps readable by authenticated"
  on public.event_rsvps for select
  using (auth.role() = 'authenticated');

create policy "rsvps insert self"
  on public.event_rsvps for insert
  with check (user_id = auth.uid());

create policy "rsvps update self"
  on public.event_rsvps for update
  using (user_id = auth.uid());

create policy "rsvps delete self"
  on public.event_rsvps for delete
  using (user_id = auth.uid());

-- Trigger-maintained going_count on club_events. Flips on insert/delete and
-- on status transitions in/out of 'going'.
create or replace function public.event_rsvps_going_count_tick()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'going' then
      update public.club_events set going_count = going_count + 1 where id = new.event_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status = 'going' and old.status <> 'going' then
      update public.club_events set going_count = going_count + 1 where id = new.event_id;
    elsif new.status <> 'going' and old.status = 'going' then
      update public.club_events set going_count = greatest(going_count - 1, 0) where id = new.event_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'going' then
      update public.club_events set going_count = greatest(going_count - 1, 0) where id = old.event_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists event_rsvps_going_count_tick on public.event_rsvps;
create trigger event_rsvps_going_count_tick
after insert or update or delete on public.event_rsvps
for each row execute function public.event_rsvps_going_count_tick();

-- ---------------------------------------------------------------------------
-- Auto-join the creator to their own club on club insert. This way the
-- "who can create events in club X" policy works immediately without a
-- follow-up insert — and the member_count trigger fires naturally.
-- ---------------------------------------------------------------------------
create or replace function public.clubs_autojoin_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_members (club_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists clubs_autojoin_creator on public.clubs;
create trigger clubs_autojoin_creator
after insert on public.clubs
for each row execute function public.clubs_autojoin_creator();
