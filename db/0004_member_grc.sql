-- =============================================================================
-- VitaFit Club — Member registration expansion + GRC numbering + avatar bucket
-- Run after 0001_init.sql, 0002_outlet_fields.sql, 0003_supabase_crud_policies.sql
-- =============================================================================

-- Extra member columns (most extended attributes live in the `extras` JSONB blob
-- so the schema does not need a migration for every new question on the form).
alter table public.members
  add column if not exists grc_no text unique,
  add column if not exists extras jsonb not null default '{}'::jsonb;

create index if not exists members_outlet_idx on public.members(outlet_id);

-- ── Storage bucket for member profile photos (public read) ───────────────────
insert into storage.buckets (id, name, public)
values ('members', 'members', true)
on conflict (id) do update set public = true;

drop policy if exists "members avatars public read" on storage.objects;
create policy "members avatars public read"
  on storage.objects for select
  using (bucket_id = 'members');

drop policy if exists "members avatars auth insert" on storage.objects;
create policy "members avatars auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'members');

drop policy if exists "members avatars auth update" on storage.objects;
create policy "members avatars auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'members')
  with check (bucket_id = 'members');

drop policy if exists "members avatars auth delete" on storage.objects;
create policy "members avatars auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'members');

notify pgrst, 'reload schema';
