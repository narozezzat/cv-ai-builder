-- Table privileges for the API roles.
--
-- Every earlier migration relies on `ALTER DEFAULT PRIVILEGES` in the Supabase
-- image having already granted `anon`, `authenticated`, and `service_role` full
-- DML on new tables in `public`. Current images no longer do: they grant only
-- TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN, and expect the schema to ask for
-- the rest. On a project created under those defaults the whole app fails with
-- `permission denied for table resumes` — a grant is checked before RLS, so a
-- policy that matches every row still gets nothing.
--
-- SECURITY: a grant here is not a widening. RLS is enabled on all of these and
-- there is no policy that returns a row the caller does not own; the grant only
-- decides whether the policies get to run at all. The rule followed below is
-- exactly one privilege per policy that exists in `20260726090200_rls.sql` —
-- nothing gets a verb it has no policy for, so a future permissive policy added
-- by mistake still cannot write to a table listed as read-only here.
--
-- Written to be idempotent and safe to apply to a project that already has the
-- old blanket defaults: the revokes reset those to a known baseline first.

-- ── Baseline ──────────────────────────────────────────────────────────────────

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

-- ── Owned rows: full CRUD, scoped by `user_id` in policy ──────────────────────

grant select, insert, update, delete on
  public.resumes,
  public.folders,
  public.resume_sections,
  public.experience,
  public.education,
  public.skills,
  public.projects,
  public.certificates,
  public.awards,
  public.publications,
  public.languages,
  public.interests,
  public.social_links,
  public.resume_references,
  public.resume_custom_entries,
  public.template_favorites
to authenticated;

-- Versions are an append-only history: written on save, restored by copying
-- forward, pruned when a resume is deleted. There is no update policy, so there
-- is no update grant — an edited history is not a history.
grant select, insert, delete on public.resume_versions to authenticated;

-- Insert is the `handle_new_user` trigger's job and delete is the account
-- cascade's; neither goes through the API role. `protect_profile_privileges()`
-- still governs which columns an update may touch.
grant select, update on public.profiles to authenticated;

-- ── Catalogue ─────────────────────────────────────────────────────────────────

-- Anyone may read the active templates — the gallery renders before sign-in.
-- The write verbs are gated to admins by `resume_templates_admin_all`, which is
-- the only reason they are granted to `authenticated` at all.
grant select on public.resume_templates to anon;
grant select, insert, update, delete on public.resume_templates to authenticated;

-- ── Ledgers: readable by their subject, written only by the service role ──────

grant select on
  public.activity_logs,
  public.ai_usage,
  public.exports,
  public.subscriptions
to authenticated;

-- `rate_limit_events` is deliberately absent: a caller who can read it learns
-- how close they are to a limit, and one who can write it clears their own
-- counter. `check_rate_limit()` is SECURITY DEFINER for exactly that reason.

-- ── Service role ──────────────────────────────────────────────────────────────

-- Not `grant all`. This role bypasses RLS entirely, so the grant list is the
-- last thing standing between a misused admin client and a table it has no
-- business touching. It mirrors what `services/supabase/admin.ts` and the export
-- pipeline actually do, and nothing else.
grant insert on public.activity_logs, public.ai_usage to service_role;
grant select, insert, update, delete on public.exports to service_role;
grant select on public.resumes to service_role;
