-- Relational projections of `resumes.content`.
--
-- These tables are derived, never authored. Application code writes jsonb to
-- `resumes.content`; `reshred_resume_content()` rebuilds the rows below inside
-- the same transaction. Nothing in the app inserts into them directly, and a
-- write that bypassed the document would be silently discarded on the owner's
-- next save.
--
-- They exist for the queries jsonb is bad at: full-text search across resume
-- bodies, "which skills appear across all my resumes", skill-gap analytics, and
-- the admin/analytics surface. Those are read patterns that want rows.
--
-- Two rules hold everywhere in this file:
--
-- 1. Every column is nullable and unconstrained beyond its type. A check
--    constraint here would fire during a user's autosave and abort the save with
--    an error about a table they have never heard of. `ResumeDocumentSchema`
--    validates on the way in; this layer's job is to mirror, not to police.
-- 2. Ordering lives in `sort_order`, derived from array position in the
--    document. The column is not called `position` because that is both a
--    Postgres function and the field name we use for a job title.
--
-- Cost of the design: the trigger and the Zod schema are one coupling that must
-- stay in step. It has a dedicated round-trip test for exactly that reason.
--
-- Cost of synchronous reshredding: autosave fires roughly every 1.5s, and each
-- save deletes and reinserts this resume's rows. That is a few dozen tuples of
-- churn per save on a per-user working set — cheap, but not free, and it does
-- generate dead tuples for autovacuum. The alternative (a debounced background
-- job) buys throughput at the price of projections that are sometimes stale,
-- which is a much worse thing to debug. If the churn ever matters, that is the
-- lever to pull.

-- ── Parsing helpers ───────────────────────────────────────────────────────────

-- Resume dates are routinely partial: users write "2021", "2021-03", or nothing
-- at all, and the document stores exactly what they typed. This normalizes to a
-- real date for querying and returns null rather than raising, because a
-- malformed date must never be able to block a save.
create or replace function public.resume_parse_date(value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text := nullif(trim(coalesce(value, '')), '');
begin
  if trimmed is null then
    return null;
  end if;

  -- Bare year and year-month are anchored to the first of the period. Resume
  -- ranges are month-precision at best, so the day carries no information.
  if trimmed ~ '^\d{4}$' then
    trimmed := trimmed || '-01-01';
  elsif trimmed ~ '^\d{4}-\d{2}$' then
    trimmed := trimmed || '-01';
  end if;

  begin
    return trimmed::date;
  exception
    when others then
      return null;
  end;
end;
$$;

comment on function public.resume_parse_date is
  'Lenient date parse for resume fields. Returns null on anything unparseable — never raises, so a malformed date cannot block a save.';

-- Highlight and keyword lists arrive as jsonb string arrays. Empty strings are
-- dropped: the editor leaves a blank trailing bullet behind constantly, and
-- those must not become rows that show up in search results.
create or replace function public.jsonb_to_text_array(value jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t.elem order by t.ord), '{}'::text[])
  from jsonb_array_elements_text(
    case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
  ) with ordinality as t(elem, ord)
  where t.elem is not null
    and length(trim(t.elem)) > 0;
$$;

comment on function public.jsonb_to_text_array is
  'jsonb string array to text[], dropping nulls and blanks. Returns an empty array for anything that is not an array.';

-- Booleans get the same treatment as dates: a value the schema should have
-- rejected must degrade to the fallback rather than abort a save with a cast
-- error. Reads the text form so a real jsonb boolean and a stringified one both
-- work — importers produce both.
create or replace function public.jsonb_to_bool(value jsonb, fallback boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(value #>> '{}', '')))
    when 'true' then true
    when 'false' then false
    else fallback
  end;
$$;

-- ── resume_sections ───────────────────────────────────────────────────────────
--
-- The section list itself: which sections a resume has, in what order, under
-- what heading, and whether the owner has hidden it. Projected so that
-- "how many people hide the references section" is a query rather than a
-- full-table jsonb scan.

create table public.resume_sections (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Document-assigned section id, stable across reorders. Not the primary key:
  -- these rows are destroyed and recreated on every save, so their identity is
  -- (resume_id, section_key), not a surrogate that changes underneath.
  section_key text,
  kind text not null,
  title text,
  is_visible boolean not null default true,
  item_count integer not null default 0,
  sort_order integer not null default 0
);

create index resume_sections_resume_idx
  on public.resume_sections (resume_id, sort_order);

create index resume_sections_kind_idx on public.resume_sections (kind);

-- ── Repeatable item tables ────────────────────────────────────────────────────
--
-- Spec names kept as-is (`experience`, `skills`, …) rather than prefixed, with
-- two forced exceptions: `references` is a reserved word and `custom_entries`
-- is too generic to sit unqualified in `public`.

create table public.experience (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  company text,
  -- Job title. `position` matches the JSON Resume field name, which keeps
  -- import/export from needing a rename layer.
  position text,
  employment_type text,
  location text,
  url text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  summary text,
  highlights text[] not null default '{}'::text[],
  technologies text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index experience_resume_idx on public.experience (resume_id, sort_order);
create index experience_user_idx on public.experience (user_id);
create index experience_technologies_idx on public.experience using gin (technologies);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  institution text,
  degree text,
  area text,
  location text,
  url text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  grade text,
  summary text,
  highlights text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index education_resume_idx on public.education (resume_id, sort_order);
create index education_user_idx on public.education (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  role text,
  description text,
  url text,
  repo_url text,
  start_date date,
  end_date date,
  highlights text[] not null default '{}'::text[],
  technologies text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index projects_resume_idx on public.projects (resume_id, sort_order);
create index projects_user_idx on public.projects (user_id);
create index projects_technologies_idx on public.projects using gin (technologies);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  category text,
  -- 0–5 in the UI. Not constrained here for the reason at the top of the file.
  level integer,
  keywords text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index skills_resume_idx on public.skills (resume_id, sort_order);
-- Serves the skill-gap query: which skills does this user already claim
-- anywhere. Lowercased because "React" and "react" are the same skill to a JD
-- matcher.
create index skills_user_name_idx on public.skills (user_id, lower(name));
create index skills_keywords_idx on public.skills using gin (keywords);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  proficiency text,
  sort_order integer not null default 0
);

create index languages_resume_idx on public.languages (resume_id, sort_order);

-- Named `certificates` per spec; the section kind in the document is
-- `certifications`.
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  issuer text,
  issue_date date,
  expiry_date date,
  credential_id text,
  url text,
  sort_order integer not null default 0
);

create index certificates_resume_idx on public.certificates (resume_id, sort_order);

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  title text,
  issuer text,
  awarded_on date,
  summary text,
  sort_order integer not null default 0
);

create index awards_resume_idx on public.awards (resume_id, sort_order);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  publisher text,
  released_on date,
  url text,
  summary text,
  sort_order integer not null default 0
);

create index publications_resume_idx on public.publications (resume_id, sort_order);

-- `references` is a reserved word; unquoted use would be a syntax error at every
-- call site.
create table public.resume_references (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  relationship text,
  company text,
  email text,
  phone text,
  summary text,
  sort_order integer not null default 0
);

create index resume_references_resume_idx
  on public.resume_references (resume_id, sort_order);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  name text,
  keywords text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index interests_resume_idx on public.interests (resume_id, sort_order);

-- User-defined sections. Projected like everything else so custom content is
-- searchable instead of invisible to every query in the app.
create table public.resume_custom_entries (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  section_key text,
  item_key text,
  name text,
  subtitle text,
  dated_on date,
  url text,
  description text,
  highlights text[] not null default '{}'::text[],
  sort_order integer not null default 0
);

create index resume_custom_entries_resume_idx
  on public.resume_custom_entries (resume_id, sort_order);

-- Contact links from `content.basics.socials`. Not a section — they render in
-- the header — but worth projecting so a profile page can list them.
create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text,
  network text,
  username text,
  url text,
  sort_order integer not null default 0
);

create index social_links_resume_idx on public.social_links (resume_id, sort_order);

-- ── The reshred trigger ───────────────────────────────────────────────────────
--
-- Delete-then-insert rather than a diff. A diff would need stable item identity
-- across saves, which reordering and undo both break; recreating a few dozen
-- rows inside a transaction that was already writing is the cheaper and far more
-- obviously-correct option.
--
-- Not SECURITY DEFINER: it runs as the user who wrote the resume, and RLS on the
-- projection tables is written to accept exactly that (see the RLS migration).
-- A definer-rights trigger here would let a bug write rows attributed to another
-- user.
create or replace function public.reshred_resume_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Tolerate a document that is missing `sections` entirely, which is the state
  -- of every freshly-created resume.
  v_sections jsonb := case
    when jsonb_typeof(new.content -> 'sections') = 'array' then new.content -> 'sections'
    else '[]'::jsonb
  end;
  v_socials jsonb := case
    when jsonb_typeof(new.content -> 'basics' -> 'socials') = 'array'
      then new.content -> 'basics' -> 'socials'
    else '[]'::jsonb
  end;
begin
  delete from public.resume_sections where resume_id = new.id;
  delete from public.experience where resume_id = new.id;
  delete from public.education where resume_id = new.id;
  delete from public.projects where resume_id = new.id;
  delete from public.skills where resume_id = new.id;
  delete from public.languages where resume_id = new.id;
  delete from public.certificates where resume_id = new.id;
  delete from public.awards where resume_id = new.id;
  delete from public.publications where resume_id = new.id;
  delete from public.resume_references where resume_id = new.id;
  delete from public.interests where resume_id = new.id;
  delete from public.resume_custom_entries where resume_id = new.id;
  delete from public.social_links where resume_id = new.id;

  insert into public.resume_sections (
    resume_id, user_id, section_key, kind, title, is_visible, item_count, sort_order
  )
  select
    new.id,
    new.user_id,
    s.section ->> 'id',
    coalesce(s.section ->> 'kind', 'custom'),
    s.section ->> 'title',
    -- Absent means visible: a section the user never touched should render.
    public.jsonb_to_bool(s.section -> 'visible', true),
    case
      when jsonb_typeof(s.section -> 'items') = 'array'
        then jsonb_array_length(s.section -> 'items')
      else 0
    end,
    s.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord);

  insert into public.experience (
    resume_id, user_id, item_key, company, position, employment_type, location, url,
    start_date, end_date, is_current, summary, highlights, technologies, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'company',
    i.item ->> 'position',
    i.item ->> 'employmentType',
    i.item ->> 'location',
    i.item ->> 'url',
    public.resume_parse_date(i.item ->> 'startDate'),
    public.resume_parse_date(i.item ->> 'endDate'),
    public.jsonb_to_bool(i.item -> 'current', false),
    i.item ->> 'summary',
    public.jsonb_to_text_array(i.item -> 'highlights'),
    public.jsonb_to_text_array(i.item -> 'technologies'),
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'experience';

  insert into public.education (
    resume_id, user_id, item_key, institution, degree, area, location, url,
    start_date, end_date, is_current, grade, summary, highlights, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'institution',
    i.item ->> 'degree',
    i.item ->> 'area',
    i.item ->> 'location',
    i.item ->> 'url',
    public.resume_parse_date(i.item ->> 'startDate'),
    public.resume_parse_date(i.item ->> 'endDate'),
    public.jsonb_to_bool(i.item -> 'current', false),
    i.item ->> 'grade',
    i.item ->> 'summary',
    public.jsonb_to_text_array(i.item -> 'highlights'),
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'education';

  insert into public.projects (
    resume_id, user_id, item_key, name, role, description, url, repo_url,
    start_date, end_date, highlights, technologies, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'role',
    i.item ->> 'description',
    i.item ->> 'url',
    i.item ->> 'repoUrl',
    public.resume_parse_date(i.item ->> 'startDate'),
    public.resume_parse_date(i.item ->> 'endDate'),
    public.jsonb_to_text_array(i.item -> 'highlights'),
    public.jsonb_to_text_array(i.item -> 'technologies'),
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'projects';

  insert into public.skills (
    resume_id, user_id, item_key, name, category, level, keywords, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'category',
    -- Guarded cast: a non-numeric level must not abort the save.
    case when i.item ->> 'level' ~ '^\d+$' then (i.item ->> 'level')::integer end,
    public.jsonb_to_text_array(i.item -> 'keywords'),
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'skills';

  insert into public.languages (
    resume_id, user_id, item_key, name, proficiency, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'proficiency',
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'languages';

  insert into public.certificates (
    resume_id, user_id, item_key, name, issuer, issue_date, expiry_date,
    credential_id, url, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'issuer',
    public.resume_parse_date(i.item ->> 'issueDate'),
    public.resume_parse_date(i.item ->> 'expiryDate'),
    i.item ->> 'credentialId',
    i.item ->> 'url',
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'certifications';

  insert into public.awards (
    resume_id, user_id, item_key, title, issuer, awarded_on, summary, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'title',
    i.item ->> 'issuer',
    public.resume_parse_date(i.item ->> 'date'),
    i.item ->> 'summary',
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'awards';

  insert into public.publications (
    resume_id, user_id, item_key, name, publisher, released_on, url, summary, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'publisher',
    public.resume_parse_date(i.item ->> 'releaseDate'),
    i.item ->> 'url',
    i.item ->> 'summary',
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'publications';

  insert into public.resume_references (
    resume_id, user_id, item_key, name, relationship, company, email, phone,
    summary, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'relationship',
    i.item ->> 'company',
    i.item ->> 'email',
    i.item ->> 'phone',
    i.item ->> 'summary',
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'references';

  insert into public.interests (
    resume_id, user_id, item_key, name, keywords, sort_order
  )
  select
    new.id,
    new.user_id,
    i.item ->> 'id',
    i.item ->> 'name',
    public.jsonb_to_text_array(i.item -> 'keywords'),
    i.ord::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'interests';

  -- Custom sections keep their section key so entries from different custom
  -- sections stay distinguishable in one table.
  insert into public.resume_custom_entries (
    resume_id, user_id, section_key, item_key, name, subtitle, dated_on, url,
    description, highlights, sort_order
  )
  select
    new.id,
    new.user_id,
    s.section ->> 'id',
    i.item ->> 'id',
    i.item ->> 'name',
    i.item ->> 'subtitle',
    public.resume_parse_date(i.item ->> 'date'),
    i.item ->> 'url',
    i.item ->> 'description',
    public.jsonb_to_text_array(i.item -> 'highlights'),
    -- Ordered within the whole resume, not within the section, so entries from
    -- two custom sections do not interleave.
    (s.ord * 1000 + i.ord)::integer
  from jsonb_array_elements(v_sections) with ordinality as s(section, ord)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.section -> 'items') = 'array' then s.section -> 'items'
         else '[]'::jsonb end
  ) with ordinality as i(item, ord)
  where s.section ->> 'kind' = 'custom';

  insert into public.social_links (
    resume_id, user_id, item_key, network, username, url, sort_order
  )
  select
    new.id,
    new.user_id,
    l.item ->> 'id',
    l.item ->> 'network',
    l.item ->> 'username',
    l.item ->> 'url',
    l.ord::integer
  from jsonb_array_elements(v_socials) with ordinality as l(item, ord);

  return null;
end;
$$;

comment on function public.reshred_resume_content is
  'Rebuilds every projection row for a resume from its jsonb document. Must stay in step with ResumeDocumentSchema; see the round-trip test.';

-- AFTER, so a failed constraint on `resumes` never leaves projections written
-- for a row that does not exist.
--
-- Two triggers rather than one `after insert or update`: the update path needs a
-- WHEN clause referencing OLD, and OLD does not exist on INSERT — Postgres
-- rejects a combined trigger whose condition mentions it.
create trigger resumes_reshred_on_insert
  after insert on public.resumes
  for each row execute function public.reshred_resume_content();

-- The condition is what keeps title renames, tag edits, favouriting, and
-- view-count bumps from reshredding a document that did not change. Without it,
-- every `update resumes set view_count = view_count + 1` from a public share
-- page would rewrite all of the owner's projection rows.
create trigger resumes_reshred_on_update
  after update on public.resumes
  for each row
  when (
    old.content is distinct from new.content
    or old.user_id is distinct from new.user_id
  )
  execute function public.reshred_resume_content();
