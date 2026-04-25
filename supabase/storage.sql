-- MotoTrack Supabase Storage buckets + RLS.
-- Run this ONCE in the Supabase SQL editor (after schema.sql).
-- Safe to re-run — all statements are idempotent.
--
-- Buckets:
--   avatars    (public)  — profile photos; path = <user_id>/avatar-*.<ext>
--   documents  (private) — legal documents (license, insurance, other);
--                          path = <user_id>/<timestamp>__<kind>__<slug>.<ext>
--
-- Access model: the first folder segment of the object path MUST equal the
-- signed-in user's auth.uid(). Supabase exposes that as
-- `(storage.foldername(name))[1]`.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = excluded.public;

-- Avatar policies: anyone can read (bucket is public), only the owner can
-- write / overwrite / delete their own folder.
drop policy if exists "avatars public read"        on storage.objects;
drop policy if exists "avatars owner insert"       on storage.objects;
drop policy if exists "avatars owner update"       on storage.objects;
drop policy if exists "avatars owner delete"       on storage.objects;

create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Document policies: private bucket. Uploads are LOCKED until the premium
-- feature ships — owners can still read and delete anything they already
-- have, but nobody can insert or overwrite new objects. To re-enable, swap
-- the `with check (false)` lines back to the owner-folder check.
drop policy if exists "documents owner read"   on storage.objects;
drop policy if exists "documents owner insert" on storage.objects;
drop policy if exists "documents owner update" on storage.objects;
drop policy if exists "documents owner delete" on storage.objects;

create policy "documents owner read"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "documents owner insert"
  on storage.objects for insert
  with check (false);

create policy "documents owner update"
  on storage.objects for update
  using (false);

create policy "documents owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
