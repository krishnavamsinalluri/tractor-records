-- Run this entire migration in Supabase Dashboard > SQL Editor.
-- Applies to existing installations without changing records or work_types RLS.
-- PUBLIC BUCKET: only use non-sensitive work illustrations. Public image URLs
-- bypass read RLS; authenticated download/list requests remain folder-restricted.
begin;

alter table public.work_types add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-type-images', 'work-type-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A restrictive guard prevents other permissive Storage policies from allowing
-- access to somebody else's folder in this bucket. Other buckets are unaffected.
drop policy if exists "Work type images folder guard" on storage.objects;
create policy "Work type images folder guard" on storage.objects
as restrictive for all to public
using (
  bucket_id <> 'work-type-images' or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
  )
)
with check (
  bucket_id <> 'work-type-images' or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  )
);

drop policy if exists "Work type images upload own folder" on storage.objects;
create policy "Work type images upload own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'work-type-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Work type images read own folder" on storage.objects;
create policy "Work type images read own folder" on storage.objects
for select to authenticated using (
  bucket_id = 'work-type-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Work type images delete own folder" on storage.objects;
create policy "Work type images delete own folder" on storage.objects
for delete to authenticated using (
  bucket_id = 'work-type-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Replacements always INSERT a unique filename; prohibit overwriting files,
-- including if an older broad policy elsewhere grants UPDATE.
drop policy if exists "Work type images no overwrites" on storage.objects;
create policy "Work type images no overwrites" on storage.objects
as restrictive for update to public
using (bucket_id <> 'work-type-images')
with check (bucket_id <> 'work-type-images');

commit;
