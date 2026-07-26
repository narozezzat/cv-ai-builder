# Reforge

The AI resume builder that gets you interviews.

A production-grade CV builder: real-time editor with autosave and undo/redo, an AI
writing suite (summaries, bullet rewriting, ATS scoring, job-description matching,
cover letters), 20 templates with switchable palettes, and server-rendered PDF /
PNG / JPEG export that cannot diverge from the on-screen preview.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
shadcn/ui on Base UI · Framer Motion · Supabase (Auth, Postgres, Storage, RLS) ·
Zustand · React Hook Form + Zod · TipTap · Puppeteer · Vercel AI SDK

## Getting started

Requires Node 24+ and pnpm 10.14 (pinned via `packageManager`).

Needs Docker Desktop running — Supabase runs locally, and the app will not boot
without its URL and anon key.

```bash
pnpm install
cp .env.example .env.local
pnpm db:start                # prints the values .env.local needs
pnpm dev
```

App on [http://localhost:3000](http://localhost:3000). `src/lib/env/public.ts`
validates the environment on import and throws with the missing keys named, so a
half-filled `.env.local` fails immediately instead of surfacing later as an
unexplained 401 from Supabase. Everything past the Supabase block in
`.env.example` is optional and feature-flags itself off: no `OPENAI_API_KEY`
disables the AI suite, no OAuth credentials hide the social sign-in buttons.

Supabase Studio then runs on `http://localhost:54323`, and outbound mail is captured
at `http://localhost:54324`, so email verification and password reset work offline.

`pnpm db:reset` reapplies every migration from scratch; `pnpm gen:types`
regenerates `src/types/database.ts` from the live schema and should be run after
any migration change.

## Scripts

| Command          | Does                                                    |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Dev server                                              |
| `pnpm build`     | Production build                                        |
| `pnpm verify`    | typecheck → lint → unit tests → build                   |
| `pnpm test`      | Vitest (unit + component, `src/**`)                     |
| `pnpm test:e2e`  | Playwright — builds and boots the app itself            |
| `pnpm format`    | Prettier write                                          |
| `pnpm db:start`  | Start local Supabase                                    |
| `pnpm db:reset`  | Re-apply all migrations from scratch                    |
| `pnpm gen:types` | Regenerate `src/types/database.ts` from the live schema |

## Architecture

Feature-sliced. `src/app` holds routes and nothing else; each slice under
`src/features` owns its components, hooks, server actions, schema, and store, and
exposes a public surface through `index.ts`. Import direction is enforced by
`eslint-plugin-boundaries`, so a cross-feature reach-in fails lint rather than
review.

Three decisions worth knowing before reading the code:

**The resume document is jsonb, and the normalized tables are projections.**
`resumes.content` is the canonical Zod-validated document — editor, preview,
renderer, and version history all read and write it, which is what makes autosave
and undo/redo O(1) and makes a version snapshot a single insert. A Postgres trigger
reshreds `content` into `experience`, `education`, `skills`, … for cross-resume
queries and analytics.

**Templates are data, not 20 components.** Six layout primitives consume a
`ResumeDocument` plus a theme token set; each template is a config referencing one
layout. Section reordering, visibility, and palette switching are therefore
implemented once and work for every template.

**One renderer, server-side export.** PDF export drives headless Chromium against
`/print/[token]` using the same component tree as the live preview, so the two
cannot drift, and the output has selectable text and real CSS page breaks.

Conventions, enforced boundaries, and the stack-specific gotchas that have already
cost time are in [AGENTS.md](AGENTS.md). Read it before your first change.

## Testing

Vitest owns `src/**/*.test.ts(x)`; Playwright owns `e2e/`. E2E runs against a
production build rather than `next dev`, because dev-mode compilation makes the
first navigation of every test slow enough to flake. CI runs both on every push and
pull request ([ci.yml](.github/workflows/ci.yml)).

## Deployment

Vercel for the app, hosted Supabase for data. `supabase link && supabase db push`
promotes migrations. Export needs `runtime = "nodejs"` and a raised `maxDuration`
on the Puppeteer route.
