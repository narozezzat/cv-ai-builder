-- ── Default template seed ─────────────────────────────────────────────────────
--
-- `resumes.template_id` is `not null default 'modern-slate'` with a foreign key
-- to `resume_templates`. With that table empty, every insert — including the
-- "New resume" button — fails with `resumes_template_id_fkey`. The default in the
-- schema is only a default if the row it names exists.
--
-- Only the default ships here. The other nineteen arrive with the template
-- registry, and each one is a row plus a token config, not a component. Keeping
-- the seed minimal means this migration does not have to be rewritten when the
-- token shape settles.
--
-- `on conflict do update` rather than `do nothing`: the row is configuration, so
-- re-running migrations should converge on the values written here instead of
-- leaving whatever an earlier version of this file inserted.

insert into public.resume_templates (
  id,
  name,
  description,
  category,
  layout,
  tokens,
  palettes,
  is_premium,
  is_active,
  sort_order
)
values (
  'modern-slate',
  'Modern Slate',
  'A single-column layout with generous spacing and a restrained slate accent. Reads cleanly in an ATS and prints without surprises.',
  'modern',
  'single-column',
  jsonb_build_object(
    'fontHeading', 'Geist',
    'fontBody', 'Geist',
    'scale', 1,
    'headingTreatment', 'uppercase-tracked',
    'dividerStyle', 'rule',
    'sectionChrome', 'none'
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'slate', 'name', 'Slate', 'accent', '#475569', 'text', '#0f172a', 'muted', '#64748b'),
    jsonb_build_object('id', 'indigo', 'name', 'Indigo', 'accent', '#4f46e5', 'text', '#0f172a', 'muted', '#64748b'),
    jsonb_build_object('id', 'emerald', 'name', 'Emerald', 'accent', '#047857', 'text', '#0f172a', 'muted', '#64748b'),
    jsonb_build_object('id', 'ink', 'name', 'Ink', 'accent', '#111827', 'text', '#111827', 'muted', '#6b7280')
  ),
  false,
  true,
  0
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  layout = excluded.layout,
  tokens = excluded.tokens,
  palettes = excluded.palettes,
  is_premium = excluded.is_premium,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
