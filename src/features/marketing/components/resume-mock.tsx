import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The resume shown in the hero.
 *
 * Deliberately CSS and text rather than a screenshot: it is sharp at every DPI,
 * costs no image request on the LCP path, respects dark mode, and cannot go
 * stale relative to the real renderer's look. It is a *depiction* of the product,
 * not the renderer itself — the real one arrives with the template engine and
 * needs a full `ResumeDocument` to draw anything.
 *
 * `aria-hidden`: the surrounding copy already says what the product does, and
 * reading out a fake person's fake job history helps nobody.
 */

function Line({ className }: { className?: string }) {
  return <div className={cn("h-1.5 rounded-full bg-foreground/10", className)} />;
}

function MockSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[0.5rem] font-semibold tracking-[0.12em] text-[oklch(0.52_0.22_280)] uppercase">
          {title}
        </span>
        <div className="h-px flex-1 bg-[oklch(0.52_0.22_280)]/20" />
      </div>
      {children}
    </div>
  );
}

export function ResumeMock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // A4 aspect so the proportions match what the builder actually exports.
        "aspect-[1/1.414] w-full overflow-hidden rounded-xl bg-white p-6 text-neutral-900 shadow-xl",
        className,
      )}
    >
      <div className="space-y-5">
        <header className="space-y-1.5">
          <div className="text-[0.95rem] leading-none font-semibold tracking-tight">
            Amara Okafor
          </div>
          <div className="text-[0.55rem] font-medium text-[oklch(0.52_0.22_280)]">
            Senior Product Engineer
          </div>
          <div className="flex gap-2 text-[0.45rem] text-neutral-500">
            <span>amara@example.com</span>
            <span>·</span>
            <span>Berlin, DE</span>
            <span>·</span>
            <span>linkedin.com/in/amara</span>
          </div>
        </header>

        <MockSection title="Summary">
          <div className="space-y-1.5">
            <Line className="w-full" />
            <Line className="w-[92%]" />
            <Line className="w-[68%]" />
          </div>
        </MockSection>

        <MockSection title="Experience">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.55rem] font-semibold">Staff Engineer · Lumen</span>
                <span className="text-[0.45rem] text-neutral-400">2022 — Now</span>
              </div>
              {/* One bullet is highlighted to show the AI accept state in situ. */}
              <div className="rounded-md bg-[oklch(0.52_0.22_280)]/8 px-2 py-1.5 ring-1 ring-[oklch(0.52_0.22_280)]/20">
                <div className="flex items-center gap-1">
                  <Sparkles className="size-2 text-[oklch(0.52_0.22_280)]" />
                  <span className="text-[0.4rem] font-semibold tracking-wide text-[oklch(0.52_0.22_280)] uppercase">
                    Rewritten
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  <Line className="w-full bg-[oklch(0.52_0.22_280)]/25" />
                  <Line className="w-[74%] bg-[oklch(0.52_0.22_280)]/25" />
                </div>
              </div>
              <div className="space-y-1">
                <Line className="w-[88%]" />
                <Line className="w-[62%]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.55rem] font-semibold">Engineer · Northwind</span>
                <span className="text-[0.45rem] text-neutral-400">2019 — 2022</span>
              </div>
              <div className="space-y-1">
                <Line className="w-full" />
                <Line className="w-[80%]" />
              </div>
            </div>
          </div>
        </MockSection>

        <MockSection title="Skills">
          <div className="flex flex-wrap gap-1">
            {["TypeScript", "React", "Postgres", "AWS", "GraphQL", "Rust"].map((skill) => (
              <span
                key={skill}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.45rem] font-medium text-neutral-600"
              >
                {skill}
              </span>
            ))}
          </div>
        </MockSection>

        <MockSection title="Education">
          <div className="flex items-baseline justify-between">
            <span className="text-[0.55rem] font-semibold">BSc Computer Science · TU Berlin</span>
            <span className="text-[0.45rem] text-neutral-400">2015 — 2019</span>
          </div>
        </MockSection>
      </div>
    </div>
  );
}

/**
 * Floating ATS score chip anchored to the mock. Split out so the hero can place
 * it independently of the document flow.
 */
export function ScoreChip({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg glass", className)}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-brand/12 text-brand">
        <Check className="size-4" strokeWidth={3} />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-semibold tabular-nums">94%</div>
        <div className="text-[0.6875rem] text-muted-foreground">ATS match</div>
      </div>
    </div>
  );
}
