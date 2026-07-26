<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Reforge — AI CV Builder

Premium AI resume builder: Supabase-backed auth and data, a real-time editor with
autosave and undo/redo, 20 templates, an AI writing/ATS suite, and server-rendered
PDF export.

## Stack, as actually installed

Check `package.json` before assuming a version. The ones that bite:

| Thing            | Version   | What differs from what you probably remember           |
| ---------------- | --------- | ------------------------------------------------------ |
| `next`           | `15.5.22` | Pinned. `create-next-app@latest` now pulls 16 — don't. |
| `react`          | `19.2.4`  | —                                                      |
| `tailwindcss`    | `4.x`     | No `tailwind.config.ts`. Config is CSS.                |
| `shadcn`         | `4.x`     | Built on Base UI, not Radix. No `asChild`.             |
| `@base-ui/react` | `1.x`     | Composition via `render`, namespaced prop types.       |
| `lucide-react`   | `1.x`     | All brand icons removed.                               |
| `zod`            | `4.x`     | —                                                      |
| `vitest`         | `4.x`     | Resolves tsconfig paths natively.                      |
| `pnpm`           | `10.14.0` | Pinned via `packageManager`. Never `npm install` here. |

### Tailwind v4 is CSS-first

Everything lives in [globals.css](src/app/globals.css): `@theme inline` for tokens,
`@custom-variant dark`, `@utility` for custom utilities. Colors are `oklch()`.
There is no JS config file to add a token to — add it to `@theme` and it becomes
both a CSS variable and a utility class.

### shadcn v4 sits on Base UI, not Radix

- **Composition is `render`, never `asChild`.** `<Button render={<Link href="/x" />}>`
  is correct; `<Button asChild>` silently does nothing.
- **Prop types are namespaced**: `AccordionPrimitive.Root.Props`, not
  `AccordionProps`.
- **Base UI packages carry their own `"use client"`**, so `button.tsx`, `card.tsx`,
  and friends import fine from server components. Don't add `"use client"` to a
  file just because it renders one.
- **Don't edit `src/components/ui/**` to fix styling.** Those are vendored and get
  regenerated. Pass `className`, or wrap in `src/components/shared/`.
- shadcn v4 ships **no `form.tsx`** — ours is hand-built at
  [src/components/shared/form/](src/components/shared/form/). Use it.

### lucide-react v1 has no brand icons

`Github`, `Twitter`, `Linkedin` etc. were removed for trademark reasons. Hand-authored
replacements live in [brand-icons.tsx](src/components/shared/brand-icons.tsx). Add
new ones there, `aria-hidden`, `fill="currentColor"`.

## Architecture

```
src/
  app/           routes only — thin. Route groups: (marketing), later (auth)/(dashboard)
  components/
    ui/          vendored shadcn primitives — regenerable, do not hand-edit
    shared/      our reusable components, exported from index.ts
    providers/   context providers mounted in the root layout
  features/      self-contained slices: components/ hooks/ actions/ schema/ store/
  hooks/ lib/ services/ types/ utils/
supabase/migrations/
```

### Import boundaries are enforced, not suggested

`eslint-plugin-boundaries` turns a bad import into a lint error. The direction:

- `app` composes features. It may import a feature **only through its `index.ts`**.
- A feature may import shared layers freely, and other features **only through
  their `index.ts`**. Never another feature's internals.
- `components/ui` may not import `components/shared` — a primitive that reaches
  back up stops being replaceable when shadcn regenerates it.
- `lib` / `utils` / `types` are leaves.

Tests, e2e, and config files are exempt (they must reach past public surfaces).
When a new import is rejected, the fix is almost always "export it from the
feature's `index.ts`", not "disable the rule".

### Where things go

| Need                                       | Put it in                |
| ------------------------------------------ | ------------------------ |
| Reusable, no feature knowledge             | `src/components/shared/` |
| Belongs to one slice                       | `src/features/<slice>/`  |
| Pure function, no React                    | `src/utils/`             |
| App-wide config, routes, tokens, SEO       | `src/lib/`               |
| Talks to an external system (Supabase, AI) | `src/services/`          |

## Conventions

- **Server Components by default.** `"use client"` only at interaction leaves.
- **Routes are never hardcoded strings.** Use [routes.ts](src/lib/routes.ts).
  `isProtectedPath` there is load-bearing for middleware — it has tests because a
  hole in it is an authorization hole.
- **Animation config is centralized** in [motion.ts](src/lib/motion.ts) +
  [use-motion-variants.ts](src/hooks/use-motion-variants.ts), which honors
  `prefers-reduced-motion`. Don't inline `transition={{ ... }}` per component.
- **Validate at every boundary with Zod** — form input, server action args, AI
  responses. AI output is untrusted input like any other.
- **Comments explain why, not what.** Non-obvious decisions get a sentence.
  Restating the code does not.
- Types: `interface` for props, `type` for unions/derived. No `any`. Prefer
  `React.ComponentProps<"div">` over hand-listing DOM props.

## Gotchas that have already cost time

- **`global-error.tsx` bypasses the root layout**, so `globals.css` is not in the
  tree. Inline styles only, and it must render its own `<html>`/`<body>`.
- **`error.tsx` must not render `error.message`.** In dev it can carry connection
  strings and SQL; the same component ships to production. Show `digest`.
- **Satori (`next/og`) supports a CSS subset**: flexbox only, no `oklch()`, no CSS
  variables, no Tailwind, and any element with more than one child needs an
  explicit `display: flex`. Brand colors are duplicated as hex in
  [opengraph-image.tsx](src/app/opengraph-image.tsx) for this reason.
- **Route group parens never appear in the URL.** `(auth)/login/page.tsx` serves
  `/login`, so a placeholder `app/signup/page.tsx` would collide with it later.
- **WebKit does not Tab to links** by default — Tab-order e2e assertions must be
  chromium-scoped.
- **`next dev` and `next start` share `.next`.** A dev server running on another
  port will recompile into the same directory and clobber the prerendered output
  `pnpm start` is serving, which surfaces as 500s on `/robots.txt`, `/sitemap.xml`,
  and the OG image. If a local `CI=1 pnpm test:e2e` fails only on those, stop the
  dev server (or rebuild) rather than debugging the routes.
- `JsonLd` escapes `<` before serializing. That escape is the only thing standing
  between a user-supplied resume title and stored XSS on a public share page.
  Its tests are security tests; don't relax them.

## Commands

```bash
pnpm dev              # dev server
pnpm verify           # typecheck + lint + unit tests + build — run before declaring done
pnpm test             # vitest, unit/component only (src/**)
pnpm test:e2e         # playwright, builds and boots the app itself
pnpm format           # prettier --write .
pnpm db:start         # local Supabase (needs Docker running)
pnpm db:reset         # re-apply migrations from scratch
pnpm gen:types        # regenerate src/types/database.ts from the local schema
```

Two test suites, no overlap: **Vitest** owns `src/**/*.test.ts(x)`, **Playwright**
owns `e2e/`. E2E runs against a production build, not `next dev`.

## Definition of done

`pnpm verify` clean **and** `pnpm test:e2e` green. No placeholder implementations,
no `TODO` left where behavior is expected to work. Loading state, empty state, and
error state exist for every async surface. Keyboard reachable and screen-reader
labelled — a11y is a lint rule here, not a review preference.
