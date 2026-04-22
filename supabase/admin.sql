-- MotoTrack — owner/developer dashboard.
-- Creates the `admins` allowlist table plus two security-definer RPCs:
--   public.am_i_admin()        → boolean; cheap gate for UI routing
--   public.admin_dashboard()   → jsonb;  aggregate stats across all users
--
-- Run this ONCE in the Supabase SQL editor after schema.sql.
-- Safe to re-run — every statement is idempotent.
--
-- To grant another account admin access:
--   insert into public.admins (email) values ('other@example.com');

-- ---------------------------------------------------------------------------
-- admins: email allowlist for owner/dev dashboard access. Row-level security
-- is enabled with NO policies, so no client can read or write directly — the
-- security-definer RPCs below access it under the postgres owner.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email       text primary key,
  created_at  timestamptz not null default now()
);

insert into public.admins (email) values ('kunjdodiya@gmail.com')
  on conflict do nothing;

alter table public.admins enable row level security;

-- ---------------------------------------------------------------------------
-- am_i_admin(): cheap "is the signed-in user an admin?" check. Used by the
-- client to render the Admin entry on the profile screen and gate the
-- /admin route before firing the heavier dashboard RPC.
-- ---------------------------------------------------------------------------
create or replace function public.am_i_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return false;
  end if;
  return exists (select 1 from public.admins where email = v_email);
end;
$$;

grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_dashboard(): every aggregate the owner needs to see app usage at a
-- glance. Authorization is enforced inside the function — it raises
-- `insufficient_privilege` (42501) for anyone not in public.admins.
--
-- Returns a jsonb blob so the client only makes one round-trip. All time
-- values are epoch milliseconds so they're directly consumable by JS Date.
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_now    timestamptz := now();
  v_result jsonb;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null
     or not exists (select 1 from public.admins where email = v_email) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with
    user_counts as (
      select
        count(*)::bigint                                                         as total,
        count(*) filter (where created_at >= v_now - interval '1 day')::bigint   as new_today,
        count(*) filter (where created_at >= v_now - interval '7 days')::bigint  as new_7d,
        count(*) filter (where created_at >= v_now - interval '30 days')::bigint as new_30d
      from auth.users
    ),
    active_users as (
      select
        count(distinct user_id) filter (where started_at >= v_now - interval '1 day')::bigint   as dau,
        count(distinct user_id) filter (where started_at >= v_now - interval '7 days')::bigint  as wau,
        count(distinct user_id) filter (where started_at >= v_now - interval '30 days')::bigint as mau
      from public.rides
    ),
    ride_counts as (
      select
        count(*)::bigint                                                                 as total,
        coalesce(sum((stats->>'distanceMeters')::numeric), 0)::numeric                   as total_distance_m,
        coalesce(sum((stats->>'durationMs')::numeric), 0)::numeric                       as total_duration_ms,
        coalesce(sum((stats->>'movingDurationMs')::numeric), 0)::numeric                 as total_moving_ms,
        count(*) filter (where started_at >= v_now - interval '1 day')::bigint           as ridden_today,
        count(*) filter (where started_at >= v_now - interval '7 days')::bigint          as ridden_7d,
        count(*) filter (where started_at >= v_now - interval '30 days')::bigint         as ridden_30d
      from public.rides
    ),
    signup_chart as (
      select jsonb_agg(
               jsonb_build_object('date', day, 'count', day_count)
               order by day
             ) as rows
      from (
        select
          to_char(d::date, 'YYYY-MM-DD') as day,
          (select count(*) from auth.users u
            where u.created_at >= d and u.created_at < d + interval '1 day')::bigint as day_count
        from generate_series(
          (v_now - interval '29 days')::date,
          v_now::date,
          interval '1 day'
        ) as d
      ) s
    ),
    top_riders as (
      select jsonb_agg(
               jsonb_build_object(
                 'userId',              t.user_id,
                 'email',               t.email,
                 'name',                t.name,
                 'rideCount',           t.ride_count,
                 'totalDistanceMeters', t.total_distance_m,
                 'totalDurationMs',     t.total_duration_ms
               ) order by t.total_distance_m desc
             ) as rows
      from (
        select
          r.user_id                                                          as user_id,
          u.email                                                            as email,
          (u.raw_user_meta_data->>'full_name')                               as name,
          count(*)::bigint                                                   as ride_count,
          coalesce(sum((r.stats->>'distanceMeters')::numeric), 0)::numeric   as total_distance_m,
          coalesce(sum((r.stats->>'durationMs')::numeric), 0)::numeric       as total_duration_ms
        from public.rides r
        join auth.users u on u.id = r.user_id
        group by r.user_id, u.email, u.raw_user_meta_data
        order by total_distance_m desc
        limit 10
      ) t
    ),
    recent_users as (
      select jsonb_agg(
               jsonb_build_object(
                 'userId',        t.user_id,
                 'email',         t.email,
                 'name',          t.name,
                 'createdAt',     t.created_at_ms,
                 'lastSignInAt',  t.last_sign_in_ms,
                 'rideCount',     t.ride_count
               ) order by t.created_at_ms desc
             ) as rows
      from (
        select
          u.id                                                  as user_id,
          u.email                                               as email,
          (u.raw_user_meta_data->>'full_name')                  as name,
          (extract(epoch from u.created_at) * 1000)::bigint     as created_at_ms,
          (extract(epoch from u.last_sign_in_at) * 1000)::bigint as last_sign_in_ms,
          (select count(*) from public.rides r where r.user_id = u.id)::bigint as ride_count
        from auth.users u
        order by u.created_at desc
        limit 20
      ) t
    )
  select jsonb_build_object(
    'generatedAt', (extract(epoch from v_now) * 1000)::bigint,
    'users', (select jsonb_build_object(
      'total',     total,
      'newToday',  new_today,
      'newLast7',  new_7d,
      'newLast30', new_30d
    ) from user_counts),
    'activeUsers', (select jsonb_build_object(
      'dau', dau,
      'wau', wau,
      'mau', mau
    ) from active_users),
    'rides', (select jsonb_build_object(
      'total',               total,
      'totalDistanceMeters', total_distance_m,
      'totalDurationMs',     total_duration_ms,
      'totalMovingMs',       total_moving_ms,
      'riddenToday',         ridden_today,
      'riddenLast7',         ridden_7d,
      'riddenLast30',        ridden_30d
    ) from ride_counts),
    'content', jsonb_build_object(
      'bikeCount',  (select count(*) from public.bikes),
      'tripCount',  (select count(*) from public.trips),
      'clubCount',  (select count(*) from public.clubs),
      'eventCount', (select count(*) from public.club_events),
      'rsvpCount',  (select count(*) from public.event_rsvps where status = 'going')
    ),
    'signupsLast30', coalesce((select rows from signup_chart), '[]'::jsonb),
    'topRiders',     coalesce((select rows from top_riders),   '[]'::jsonb),
    'recentUsers',   coalesce((select rows from recent_users), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_dashboard() to authenticated;
