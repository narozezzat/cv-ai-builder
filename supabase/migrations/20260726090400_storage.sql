-- Storage buckets and their policies.
--
-- In a migration rather than `config.toml` because `supabase db push` carries
-- migrations to the hosted project and does not carry config. A bucket declared
-- only in config exists locally, works in development, and is missing in
-- production — which surfaces as a 404 on the first avatar upload after deploy.
--
-- `storage.objects` is a normal table with RLS, so these are normal policies. The
-- one thing that is not normal is the path convention: every policy below keys
-- authorization off the first path segment being the owner's user id. That makes
-- `<user_id>/<filename>` load-bearing rather than tidy, so it is asserted in code
-- as well as documented here.

-- ── Buckets ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    -- Public. Avatars are rendered by <img> in shared resume pages and OpenGraph
    -- cards, where a signed URL would expire mid-crawl and leave a broken image
    -- in a Slack unfurl forever.
    true,
    2 * 1024 * 1024,
    -- No SVG. An SVG is a document that can carry script, and this bucket is
    -- served from the same origin as the app.
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'exports',
    'exports',
    -- Private. A generated PDF is the user's full CV: name, address, phone,
    -- employment history. Downloads go through short-lived signed URLs.
    false,
    25 * 1024 * 1024,
    array['application/pdf', 'image/png', 'image/jpeg']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── avatars ───────────────────────────────────────────────────────────────────

-- Anonymous read is the point of a public bucket; the policy still has to exist.
create policy avatars_read_all on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- `(storage.foldername(name))[1]` is the first path segment. Without this a user
-- could upload to another user's folder and replace their avatar.
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update as well as insert: replacing an avatar is an upsert, and without an
-- update policy the second upload of the same path fails.
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── exports ───────────────────────────────────────────────────────────────────

-- Owners can list and read their own exports. Signed URLs are minted server-side
-- and are what the download button actually uses; this policy is what lets the
-- export history page enumerate the files.
create policy exports_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No insert or update policy. Export files are written by the render pipeline
-- with the service role, and a client-writable exports bucket would let a user
-- upload an arbitrary PDF and have it served back under a signed URL from our
-- origin — which is a stored-content attack, not a resume feature.

-- Deleting is a user action: clearing download history should remove the files,
-- not just the rows.
create policy exports_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
