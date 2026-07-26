-- Row Level Security.
--
-- This is the authorization layer. Not the middleware, not the server actions —
-- those are usability, and either can be bypassed by anyone holding the anon key,
-- which ships in the client bundle by design. If a policy in this file is wrong,
-- the app is wrong no matter what the TypeScript says.
--
-- Principles applied throughout:
--
-- * Every table gets RLS enabled, including the ones with no policies. A table
--   with RLS on and zero policies denies everything, which is the correct default
--   for anything only trusted server code should touch.
-- * Policies are per-command. `for all` hides the difference between "can read"
--   and "can overwrite", and the two are rarely the same answer.
-- * `using` gates which existing rows are visible; `with check` gates what a row
--   is allowed to become. Both are spelled out on writes — a `using`-only update
--   policy lets a user take a row they own and reassign it to someone else.
-- * The public share page does NOT get a permissive select policy on `resumes`.
--   See the note on `get_public_resume` below; this is the single most tempting
--   mistake in the whole schema.

-- ── Admin check ───────────────────────────────────────────────────────────────
--
-- SECURITY DEFINER is load-bearing, not laziness. A policy on `profiles` that
-- reads `profiles` to find the caller's role re-enters the same policy and
-- Postgres raises "infinite recursion detected in policy". Running as the owner
-- steps outside RLS for that one lookup and breaks the cycle.
--
-- STABLE so it is evaluated once per statement instead of once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin is
  'True when the caller is an admin. SECURITY DEFINER to avoid policy recursion on profiles — see the note in the RLS migration.';

revoke execute on function public.is_admin() from anon;

-- ── profiles ──────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- No insert policy: rows are created by the `handle_new_user` trigger, which is
-- SECURITY DEFINER and therefore not subject to this. A user who could insert
-- here could create a profile for an id that is not theirs.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: account deletion happens through GoTrue and cascades from
-- `auth.users`. A user deleting their profile row directly would leave a working
-- login with no profile, which every query in the app reads as corruption.

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- ── folders ───────────────────────────────────────────────────────────────────

alter table public.folders enable row level security;

create policy folders_select_own on public.folders
  for select to authenticated
  using (auth.uid() = user_id);

create policy folders_insert_own on public.folders
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy folders_update_own on public.folders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy folders_delete_own on public.folders
  for delete to authenticated
  using (auth.uid() = user_id);

-- ── resumes ───────────────────────────────────────────────────────────────────

alter table public.resumes enable row level security;

-- Trashed resumes are deliberately included: the trash view is a normal query
-- and filters on `deleted_at` in application code. Hiding them at the policy
-- level would make "restore" impossible without service-role access.
create policy resumes_select_own on public.resumes
  for select to authenticated
  using (auth.uid() = user_id);

create policy resumes_insert_own on public.resumes
  for insert to authenticated
  with check (auth.uid() = user_id);

-- The `with check` is what stops `update resumes set user_id = '<someone else>'`,
-- which a `using`-only policy would happily allow — the row is visible before the
-- change, and nothing would examine it after.
create policy resumes_update_own on public.resumes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy resumes_delete_own on public.resumes
  for delete to authenticated
  using (auth.uid() = user_id);

-- NO public select policy on this table, on purpose.
--
-- The obvious implementation of share links is a policy like
-- `using (visibility <> 'private')`. That is an enumeration hole: RLS filters
-- rows, it cannot see the `share_slug` the client asked for, so anyone holding
-- the anon key could run `select * from resumes` and page through every shared
-- resume in the system — including "unlisted" ones, whose entire security
-- property is that they are reachable only by someone who has the link.
--
-- Public reads therefore go through the function below, which takes the slug as
-- an argument and can only ever return one row.

create policy resumes_select_admin on public.resumes
  for select to authenticated
  using (public.is_admin());

-- ── Public share access ───────────────────────────────────────────────────────

create or replace function public.get_public_resume(p_share_slug text)
returns table (
  id uuid,
  title text,
  content jsonb,
  template_id text,
  theme jsonb,
  page jsonb,
  allow_indexing boolean,
  view_count integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.title,
    r.content,
    r.template_id,
    r.theme,
    r.page,
    r.allow_indexing,
    r.view_count,
    r.updated_at
  from public.resumes r
  where r.share_slug = p_share_slug
    and r.visibility <> 'private'
    and r.deleted_at is null
  limit 1;
$$;

comment on function public.get_public_resume is
  'The only public read path into resumes. Takes the slug as an argument so it cannot be used to enumerate shared resumes, and omits user_id and share settings. Security-sensitive: read the note above it before changing.';

-- Deliberately callable by anonymous visitors — that is the point of a share
-- link. `owner_id` and every sharing control are excluded from the return type so
-- a public page cannot learn who owns the resume or revoke the link.
grant execute on function public.get_public_resume(text) to anon, authenticated;

-- View counting is separate from reading. Folding it into `get_public_resume`
-- would make that function volatile, which costs the planner the ability to
-- treat it as a stable read, and would count a view every time a bot fetched
-- OpenGraph metadata for the same request.
create or replace function public.increment_resume_view(p_share_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.resumes
     set view_count = view_count + 1
   where share_slug = p_share_slug
     and visibility <> 'private'
     and deleted_at is null;
$$;

comment on function public.increment_resume_view is
  'Bumps the view counter for a shared resume. Cannot be used to discover whether a slug exists: returns void either way.';

grant execute on function public.increment_resume_view(text) to anon, authenticated;

-- ── resume_versions ───────────────────────────────────────────────────────────

alter table public.resume_versions enable row level security;

create policy resume_versions_select_own on public.resume_versions
  for select to authenticated
  using (auth.uid() = user_id);

-- The `exists` is not redundant with `auth.uid() = user_id`. Without it a user
-- can insert a version row carrying their own user_id but pointing at someone
-- else's resume_id, which puts foreign rows in that resume's version chain and
-- lets them consume its version numbers. One indexed lookup per insert is a fair
-- price for closing that.
create policy resume_versions_insert_own on public.resume_versions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.resumes r
      where r.id = resume_id
        and r.user_id = auth.uid()
    )
  );

-- Pruning old snapshots is allowed; editing them is not. A version history that
-- can be rewritten is not a history.
create policy resume_versions_delete_own on public.resume_versions
  for delete to authenticated
  using (auth.uid() = user_id);

-- ── resume_templates ──────────────────────────────────────────────────────────

alter table public.resume_templates enable row level security;

-- Readable anonymously so the marketing site can show the real gallery instead
-- of a hardcoded copy that drifts. Premium templates are listed but gated at the
-- point of use, not hidden — a paywall you cannot see is a paywall that does not
-- sell.
create policy resume_templates_select_active on public.resume_templates
  for select to anon, authenticated
  using (is_active);

create policy resume_templates_admin_all on public.resume_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Projection tables ─────────────────────────────────────────────────────────
--
-- Owners get full CRUD on their own projection rows. That looks over-permissive
-- for derived data, and it is the deliberate trade: `reshred_resume_content()`
-- runs with the privileges of whoever saved the resume, so these policies are
-- what let a user's own save write their own projections.
--
-- The alternative is making that trigger SECURITY DEFINER, which would give it
-- owner rights over thirteen tables and make any bug in it a cross-tenant write.
-- Between "a user can hand-insert a row into their own projection, which their
-- next save overwrites" and "a trigger bug can write rows attributed to another
-- user", the first is obviously the smaller hazard.
--
-- Note the `with check` on the write policies still pins `user_id` to the
-- caller, so nothing here reaches another tenant's data either way.

do $$
declare
  target text;
begin
  foreach target in array array[
    'resume_sections',
    'experience',
    'education',
    'projects',
    'skills',
    'languages',
    'certificates',
    'awards',
    'publications',
    'resume_references',
    'interests',
    'resume_custom_entries',
    'social_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', target);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      target || '_select_own', target
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      target || '_insert_own', target
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      target || '_update_own', target
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      target || '_delete_own', target
    );
  end loop;
end;
$$;

-- ── Read-only-to-clients tables ───────────────────────────────────────────────
--
-- `exports`, `ai_usage`, `activity_logs`, and `subscriptions` are records of what
-- happened. Users read their own; nobody writes them from a client session. All
-- four are written by `services/supabase/admin.ts` with the service role, which
-- bypasses RLS.
--
-- The explicit `revoke` after each is belt-and-braces: RLS already denies these
-- commands for lack of a policy, but the revoke means a future permissive policy
-- added by mistake still cannot grant write access. It fails closed.

alter table public.exports enable row level security;

create policy exports_select_own on public.exports
  for select to authenticated
  using (auth.uid() = user_id);

create policy exports_select_admin on public.exports
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.exports from anon, authenticated;

alter table public.ai_usage enable row level security;

-- The credit balance shown in the UI comes from `profiles.ai_credits`; this is
-- the itemized history behind it, which users are entitled to see.
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (auth.uid() = user_id);

create policy ai_usage_select_admin on public.ai_usage
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.ai_usage from anon, authenticated;

alter table public.activity_logs enable row level security;

-- A log a user can write is not a log. Read-only even to its subject.
create policy activity_logs_select_own on public.activity_logs
  for select to authenticated
  using (auth.uid() = user_id);

create policy activity_logs_select_admin on public.activity_logs
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.activity_logs from anon, authenticated;

alter table public.subscriptions enable row level security;

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy subscriptions_select_admin on public.subscriptions
  for select to authenticated
  using (public.is_admin());

-- Entitlements are set by billing webhooks only. A client that could write here
-- could grant itself a plan.
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ── rate_limit_events ─────────────────────────────────────────────────────────
--
-- RLS on, zero policies: no client role can read, insert, or delete a row. The
-- only access path is `check_rate_limit`, which is SECURITY DEFINER.
--
-- This is the whole security model of the rate limiter. A client that could
-- delete from this table could reset its own limit; one that could read it could
-- probe other users' activity by subject id.

alter table public.rate_limit_events enable row level security;

revoke all on public.rate_limit_events from anon, authenticated;
