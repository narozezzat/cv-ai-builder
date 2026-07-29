-- ── template_favorites ────────────────────────────────────────────────────────
--
-- Which templates a user has starred in the gallery.
--
-- A real table rather than `localStorage` for the same reason every other preference
-- is one: the gallery is opened from the dashboard on a laptop and from the editor on
-- a phone, and a favourite that only exists in one browser reads as a bug. It is also
-- the only signal the app will have for "most starred template" once the admin surface
-- wants it — a number no client-side store could ever produce.
--
-- Composite primary key, no surrogate id. The row *is* the pair, so the key is the pair:
-- that makes a duplicate star impossible at the storage layer instead of relying on the
-- action to check first, and makes `on conflict do nothing` the natural idempotent insert.
--
-- `template_id` references `resume_templates` the way `resumes.template_id` does, but
-- cascades where that one restricts. The asymmetry is deliberate: deleting a template
-- somebody's resume is built on must fail loudly, because the document would lose its
-- design; a favourite pointing at a retired template has nothing to render in the gallery
-- and should simply disappear with it. Note that retiring a template is normally
-- `is_active = false`, not a delete — this only governs the hard case.

create table public.template_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null references public.resume_templates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

-- The gallery's only query is "every favourite of this user", and the primary key's
-- index already leads on `user_id`, so no second index is needed here.

comment on table public.template_favorites is
  'Templates a user has starred in the gallery. Composite key makes a duplicate star impossible.';

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- Same four-policy shape as every other owned table: per-command, and `with check`
-- alongside `using` on update so a row cannot be handed to another user. There is no
-- admin policy — nothing in the product needs to read someone else's favourites, and
-- aggregate counts belong to a SECURITY DEFINER function if they are ever wanted.

alter table public.template_favorites enable row level security;

create policy template_favorites_select_own on public.template_favorites
  for select to authenticated
  using (auth.uid() = user_id);

create policy template_favorites_insert_own on public.template_favorites
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy template_favorites_update_own on public.template_favorites
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy template_favorites_delete_own on public.template_favorites
  for delete to authenticated
  using (auth.uid() = user_id);
