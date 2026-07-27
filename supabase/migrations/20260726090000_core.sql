-- Core schema: identity, resumes, versions, templates, exports, billing, metering.
--
-- The central decision in here: `resumes.content` is the canonical resume
-- document, stored as jsonb and validated by `ResumeDocumentSchema` on the way
-- in. The relational tables in the next migration are projections of it, kept in
-- step by a trigger. Rationale: autosave fires every ~1.5s and undo/redo needs
-- whole-document snapshots, both of which are one write against jsonb and a
-- dozen coordinated writes against a normalized model.
--
-- Every table that users can reach carries `user_id` directly, even where it
-- could be reached by joining through `resumes`. RLS policies are evaluated per
-- row on every query; a policy that joins is a policy that gets slow and, worse,
-- is easy to get subtly wrong. Denormalizing the owner keeps every policy a
-- single `auth.uid() = user_id` comparison.

-- ── Shared helpers ────────────────────────────────────────────────────────────

-- `search_path = ''` on every function in this schema: an unqualified name in a
-- SECURITY DEFINER function can be captured by an attacker-controlled schema
-- earlier in the caller's search_path. Empty means every reference must be
-- schema-qualified, which is why `public.` appears everywhere below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Maintains updated_at on write. Attached to every table that has the column.';

-- Immutable text[] flattener, needed by `resumes.search_vector`.
--
-- Postgres marks the built-in `array_to_string(anyarray, text)` STABLE, not
-- IMMUTABLE, because for a polymorphic argument it has to reach the element
-- type's output function — which in general may depend on GUCs (think
-- `timestamptz` and `TimeZone`). A generated column requires immutability, so the
-- built-in cannot be used in one and Postgres rejects the table with
-- `42P17 generation expression is not immutable`.
--
-- Narrowing the signature to `text[]` removes the reason for the STABLE marking:
-- text's output function is the identity, so the result depends on nothing but the
-- arguments. The marking below is therefore a fact about this signature, not an
-- override of the planner's judgement about the general case.
create or replace function public.array_to_search_text(value text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_to_string(value, ' '), '')
$$;

comment on function public.array_to_search_text is
  'Joins a text[] for full-text indexing. Immutable, unlike array_to_string(anyarray, text), so it is usable in a generated column.';

-- ── Enumerated types ──────────────────────────────────────────────────────────
--
-- Enums are used only for genuinely closed sets. Things that grow with product
-- surface — AI capability names, activity actions, section kinds — are text with
-- a check constraint instead: `alter type ... add value` cannot run inside a
-- transaction block, so an enum turns "we shipped a 17th AI action" into a
-- migration that cannot be applied atomically.

create type public.user_role as enum ('user', 'admin');

create type public.resume_visibility as enum ('private', 'unlisted', 'public');

create type public.export_format as enum ('pdf', 'png', 'jpeg');

create type public.export_status as enum ('pending', 'processing', 'completed', 'failed');

create type public.subscription_plan as enum ('free', 'pro', 'team');

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete'
);

-- ── resume_templates ──────────────────────────────────────────────────────────
--
-- Templates are data, not components: `layout` names one of six React layout
-- primitives and `tokens`/`palettes` carry the design decisions. Template #21 is
-- therefore a row, not a new component with its own bugs.
--
-- Rows live in the database rather than only in the TypeScript registry so the
-- future admin surface can deactivate or reorder a template without a deploy.

create table public.resume_templates (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  category text not null,
  layout text not null check (
    layout in (
      'single-column',
      'sidebar-left',
      'sidebar-right',
      'header-banner',
      'timeline-split',
      'two-column-balanced'
    )
  ),
  tokens jsonb not null default '{}'::jsonb,
  palettes jsonb not null default '[]'::jsonb,
  preview_path text,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resume_templates_active_idx
  on public.resume_templates (is_active, sort_order);

create trigger resume_templates_set_updated_at
  before update on public.resume_templates
  for each row execute function public.set_updated_at();

-- ── profiles ──────────────────────────────────────────────────────────────────
--
-- 1:1 with auth.users. Exists because `auth.users` is not safely readable by
-- application code and must not carry product columns.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  headline text check (char_length(headline) <= 200),
  avatar_url text,
  role public.user_role not null default 'user',
  -- Metered AI. The ledger of record is `ai_usage`; this is the running balance
  -- so a request can be rejected without aggregating the ledger.
  ai_credits integer not null default 50 check (ai_credits >= 0),
  locale text not null default 'en' check (locale in ('en', 'ar')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  -- Tone, verbosity, spelling region. Shape owned by Zod, not by a column per
  -- preference: these change with the AI surface and none of them are queried.
  ai_preferences jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role = 'admin';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Users own their profile row and must be able to update it, but two of its
-- columns are privileges rather than preferences. RLS grants access per row, not
-- per column, so without this the same `update profiles set ...` that changes a
-- display name can also grant admin and mint AI credits.
--
-- Both are reset to their previous values unless the writer is the service role.
-- Silent rather than an error: the client legitimately round-trips whole rows.
--
-- `ai_credits` has one further exemption. Metering runs through
-- `public.charge_ai_credits`, a SECURITY DEFINER function that executes as the
-- table owner but still carries the caller's JWT — so the service-role test above
-- does not match, and without an escape hatch the trigger would silently undo
-- every charge and make the AI suite free. That function sets
-- `app.privileged_write` with `is_local => true`, so the exemption lasts exactly
-- as long as its transaction.
--
-- `role` gets no such exemption. Nothing but the service role ever changes it.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
    return new;
  end if;

  new.role := old.role;

  if coalesce(current_setting('app.privileged_write', true), '') <> 'ai_credits' then
    new.ai_credits := old.ai_credits;
  end if;

  return new;
end;
$$;

comment on function public.protect_profile_privileges is
  'Prevents privilege and credit escalation through the profile update path. Security control: do not remove.';

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Provisions the profile as part of the signup transaction. A profile created
-- later from application code would leave every new account in a state where
-- `select ... from profiles` returns nothing, which is indistinguishable from a
-- deleted account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    -- Email/password signup puts this in `full_name`; Google and GitHub use
    -- `name`. Neither is guaranteed.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps the denormalized email in step when the user changes it through GoTrue.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ── folders ───────────────────────────────────────────────────────────────────

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index folders_user_idx on public.folders (user_id, sort_order);

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

-- ── resumes ───────────────────────────────────────────────────────────────────

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Untitled resume'
    check (char_length(title) between 1 and 200),
  -- Canonical document. Validated against ResumeDocumentSchema before every
  -- write; the projection tables are derived from it.
  content jsonb not null default '{}'::jsonb,
  template_id text not null default 'modern-slate'
    references public.resume_templates (id) on update cascade on delete restrict,
  -- Palette id, font pairing, and per-resume token overrides.
  theme jsonb not null default '{}'::jsonb,
  -- Page format, margins, scale. Read by both the preview and the PDF renderer.
  page jsonb not null default '{}'::jsonb,
  visibility public.resume_visibility not null default 'private',
  -- Unguessable, and rotatable without changing the resume id. The public read
  -- policy matches on this, so a leaked link is revoked by nulling the column.
  share_slug text unique check (share_slug ~ '^[a-z0-9]{8,64}$'),
  -- Public pages are noindex unless the owner opts in. Default off: a resume is
  -- a pile of personal data and search-indexing it must be a decision.
  allow_indexing boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  download_count integer not null default 0 check (download_count >= 0),
  tags text[] not null default '{}'::text[],
  is_favorite boolean not null default false,
  last_edited_at timestamptz not null default now(),
  -- Trash bin. Every owner-facing query filters on this; permanent deletion is a
  -- separate explicit action.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Covers the metadata the dashboard search box actually searches. Deliberately
  -- not the document body: full-text over the resume text is served by the
  -- projection tables, which are already shredded into rows and can be ranked
  -- per section instead of as one undifferentiated blob.
  -- `'english'::regconfig` and not `'english'`: the bare literal would be resolved
  -- at parse time against the session's search config, which is exactly the kind of
  -- GUC dependency a generated column may not have.
  search_vector tsvector generated always as (
    to_tsvector(
      'english'::regconfig,
      coalesce(title, '') || ' ' || public.array_to_search_text(tags)
    )
  ) stored
);

comment on column public.resumes.content is
  'Canonical resume document. Shape owned by ResumeDocumentSchema in src/types/resume.ts; the projection tables are rebuilt from it by reshred_resume_content().';

-- Partial: the dashboard never lists trashed resumes, so they should not be in
-- the index it uses.
create index resumes_user_active_idx
  on public.resumes (user_id, last_edited_at desc)
  where deleted_at is null;

create index resumes_user_trashed_idx
  on public.resumes (user_id, deleted_at desc)
  where deleted_at is not null;

create index resumes_folder_idx
  on public.resumes (folder_id)
  where folder_id is not null and deleted_at is null;

create index resumes_tags_idx on public.resumes using gin (tags);

create index resumes_search_idx on public.resumes using gin (search_vector);

-- Serves the public share page lookup, which is the one query in the app that
-- arrives without a user id.
create index resumes_share_slug_idx
  on public.resumes (share_slug)
  where share_slug is not null and visibility <> 'private';

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

-- ── resume_versions ───────────────────────────────────────────────────────────
--
-- A version is a whole-document snapshot, which is only cheap because the
-- document is a single jsonb column.

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  label text check (char_length(label) <= 120),
  origin text not null default 'manual'
    check (origin in ('manual', 'autosave', 'ai', 'import', 'restore')),
  created_at timestamptz not null default now(),
  unique (resume_id, version)
);

create index resume_versions_resume_idx
  on public.resume_versions (resume_id, version desc);

-- Assigns the next version number inside the insert. Doing this in application
-- code needs a `max(version) + 1` read first, which two concurrent autosaves
-- will both win.
create or replace function public.assign_resume_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version is null or new.version = 0 then
    select coalesce(max(v.version), 0) + 1
      into new.version
      from public.resume_versions v
     where v.resume_id = new.resume_id;
  end if;

  return new;
end;
$$;

create trigger resume_versions_assign_version
  before insert on public.resume_versions
  for each row execute function public.assign_resume_version();

-- ── exports ───────────────────────────────────────────────────────────────────

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  format public.export_format not null,
  status public.export_status not null default 'pending',
  -- Path inside the private `exports` bucket. Access is by signed URL only.
  storage_path text,
  file_size_bytes bigint check (file_size_bytes >= 0),
  page_count integer check (page_count > 0),
  duration_ms integer check (duration_ms >= 0),
  -- Provider/renderer error, for support. Never rendered to the user verbatim:
  -- Chromium messages leak internal URLs and file paths.
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index exports_user_idx on public.exports (user_id, created_at desc);

create index exports_resume_idx on public.exports (resume_id, created_at desc);

-- ── subscriptions ─────────────────────────────────────────────────────────────
--
-- Not wired to a payment provider yet. Present because plan and credit
-- allowance are read on the AI path from day one, and retrofitting a billing
-- table under a live credit system is worse than an unused table.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'active',
  provider text check (provider in ('stripe', 'paddle', 'lemonsqueezy')),
  provider_customer_id text,
  provider_subscription_id text unique,
  monthly_ai_credits integer not null default 50 check (monthly_ai_credits >= 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── ai_usage ──────────────────────────────────────────────────────────────────
--
-- Append-only ledger. Every AI call writes one row whether it succeeded or not,
-- because a provider timeout that consumed tokens still cost money.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  -- Free text, matching the capability ids in the typed prompt registry. Not an
  -- enum on purpose: see the note above the type definitions.
  capability text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer generated always as (prompt_tokens + completion_tokens) stored,
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  credits_charged integer not null default 0 check (credits_charged >= 0),
  latency_ms integer check (latency_ms >= 0),
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

create index ai_usage_capability_idx on public.ai_usage (capability, created_at desc);

-- ── activity_logs ─────────────────────────────────────────────────────────────
--
-- Feeds the dashboard activity list and doubles as the audit trail. Users can
-- read their own rows and cannot write any: a log a user can forge is not a log.

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 64),
  entity_type text check (entity_type in ('resume', 'template', 'export', 'profile', 'auth')),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index activity_logs_user_idx on public.activity_logs (user_id, created_at desc);

-- ── rate_limit_events ─────────────────────────────────────────────────────────
--
-- Sliding-window counters for AI calls, exports, and share-link creation.
-- Postgres rather than Redis: the limits are per-user and low-frequency, the
-- database is already on the request path, and adding a second stateful service
-- to the deployment for a few thousand counter rows is not a trade worth making.
--
-- No RLS policy is created for this table (see the RLS migration) — it is
-- reachable only through `check_rate_limit`, which is SECURITY DEFINER. A client
-- that could read or delete rows here could clear its own limit.

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  -- User id for authenticated actions, hashed IP for anonymous ones.
  subject text not null,
  action text not null,
  occurred_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (subject, action, occurred_at desc);
