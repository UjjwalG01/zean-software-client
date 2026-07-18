-- Make members avatar bucket private and require auth for reads.
update storage.buckets set public = false where id = 'members';

drop policy if exists "members avatars public read" on storage.objects;
drop policy if exists "members avatars auth read"   on storage.objects;
create policy "members avatars auth read" on storage.objects
  for select to authenticated using (bucket_id = 'members');
