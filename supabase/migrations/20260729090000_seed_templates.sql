-- ── Template catalogue seed (all twenty) ──────────────────────────────────────
--
-- `resumes.template_id` has a foreign key to `resume_templates`, so a template the
-- registry offers but the database has never heard of is not merely missing from an
-- admin list — it makes every insert naming it fail. All twenty ship here.
--
-- Deliberately metadata only. `tokens` and `palettes` are reset to empty:
--
--   the TypeScript registry in `src/features/templates/registry/` owns the design,
--   this table owns availability, ordering, and pricing.
--
-- Copying eighty palettes and twenty token objects into SQL would create a second
-- source of truth that no test compares against the first, and the renderer reads the
-- registry regardless — a mismatched row would be silently ignored, which is worse than
-- an empty one. The columns stay because an admin surface may later store per-template
-- overrides; until something reads them, they hold nothing rather than something stale.
--
-- This also clears the `tokens` written by `20260727120000_seed_default_template.sql`,
-- whose keys (`fontHeading`, `headingTreatment`, …) predate the settled token shape.
--
-- `sort_order` is the gallery order and matches the `TEMPLATES` array: two per category,
-- categories grouped, `modern-slate` first because it is `DEFAULT_TEMPLATE_ID`.
--
-- `on conflict do update` rather than `do nothing`: these rows are configuration, so a
-- re-run must converge on the values written here.

insert into public.resume_templates (
  id, name, description, category, layout, tokens, palettes, is_premium, is_active, sort_order
)
values
  (
    'modern-slate',
    'Modern Slate',
    'A single column with generous spacing and a restrained slate accent. Reads cleanly in an ATS and prints without surprises.',
    'modern', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 0
  ),
  (
    'modern-aurora',
    'Modern Aurora',
    'A full-bleed colour band behind the name, then a clean single column. Contemporary without being loud.',
    'modern', 'header-banner', '{}'::jsonb, '[]'::jsonb, false, true, 1
  ),
  (
    'minimal-thin',
    'Minimal Thin',
    'Mixed-case headings, no rules, no fills. The lightest template in the set.',
    'minimal', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 2
  ),
  (
    'minimal-quiet',
    'Minimal Quiet',
    'Small tracked headings in a left gutter, bodies behind a hairline. Structure from position, not chrome.',
    'minimal', 'timeline-split', '{}'::jsonb, '[]'::jsonb, false, true, 3
  ),
  (
    'professional-ledger',
    'Professional Ledger',
    'Underlined sections, ruled entries, a compact rhythm. The safest thing to send to a large employer.',
    'professional', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 4
  ),
  (
    'professional-brief',
    'Professional Brief',
    'A tinted left column for skills and credentials, history beside it. Fits a dense career on one page.',
    'professional', 'sidebar-left', '{}'::jsonb, '[]'::jsonb, false, true, 5
  ),
  (
    'creative-canvas',
    'Creative Canvas',
    'A wide solid sidebar, filled section bars, a large name. Built to be remembered.',
    'creative', 'sidebar-left', '{}'::jsonb, '[]'::jsonb, true, true, 6
  ),
  (
    'creative-arc',
    'Creative Arc',
    'A centred name on a deep banner, mixed-case headings, no rules. Warm and editorial.',
    'creative', 'header-banner', '{}'::jsonb, '[]'::jsonb, true, true, 7
  ),
  (
    'executive-mono',
    'Executive Mono',
    'Serif headings over a sans body, centred, ruled entries. Restrained and senior.',
    'executive', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 8
  ),
  (
    'executive-crest',
    'Executive Crest',
    'A display serif name on a deep banner, wide tracking, ruled entries. For board-level history.',
    'executive', 'header-banner', '{}'::jsonb, '[]'::jsonb, true, true, 9
  ),
  (
    'tech-terminal',
    'Tech Terminal',
    'Monospace headings, tight rhythm, a stack column on the right. Reads like a well-kept README.',
    'tech', 'sidebar-right', '{}'::jsonb, '[]'::jsonb, false, true, 10
  ),
  (
    'tech-grid',
    'Tech Grid',
    'Two balanced columns at a compact rhythm. Fits projects, stack, and history on one page.',
    'tech', 'two-column-balanced', '{}'::jsonb, '[]'::jsonb, false, true, 11
  ),
  (
    'designer-studio',
    'Designer Studio',
    'Wide colour sidebar on the right, large name, filled section bars. Confident and graphic.',
    'designer', 'sidebar-right', '{}'::jsonb, '[]'::jsonb, true, true, 12
  ),
  (
    'designer-portfolio',
    'Designer Portfolio',
    'Centred header over two columns, mixed-case headings, no rules. Made for project-led work.',
    'designer', 'two-column-balanced', '{}'::jsonb, '[]'::jsonb, true, true, 13
  ),
  (
    'corporate-navy',
    'Corporate Navy',
    'Filled section bars, ruled entries, single column. Familiar to every hiring committee.',
    'corporate', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 14
  ),
  (
    'corporate-column',
    'Corporate Column',
    'Tinted left rail for skills and credentials, ruled entries beside it. Prints cleanly in mono.',
    'corporate', 'sidebar-left', '{}'::jsonb, '[]'::jsonb, false, true, 15
  ),
  (
    'elegant-serif',
    'Elegant Serif',
    'Display serif over a serif body, centred header, airy leading. For editorial and academic work.',
    'elegant', 'single-column', '{}'::jsonb, '[]'::jsonb, false, true, 16
  ),
  (
    'elegant-line',
    'Elegant Line',
    'Small tracked-out headings in a gutter, bodies behind a hairline rule. Quiet and considered.',
    'elegant', 'timeline-split', '{}'::jsonb, '[]'::jsonb, true, true, 17
  ),
  (
    'startup-pitch',
    'Startup Pitch',
    'Solid colour rail on the right, filled section bars, punchy scale. Reads like a deck slide.',
    'startup', 'sidebar-right', '{}'::jsonb, '[]'::jsonb, false, true, 18
  ),
  (
    'startup-sprint',
    'Startup Sprint',
    'Two balanced columns at a tight rhythm. Built to hold projects, stack, and history on one page.',
    'startup', 'two-column-balanced', '{}'::jsonb, '[]'::jsonb, false, true, 19
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
