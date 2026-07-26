import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { ButtonLink, FadeUp, Stagger, StaggerItem } from "@/components/shared";
import { routes } from "@/lib/routes";

import { HERO_PROOF } from "../content";
import { ResumeMock, ScoreChip } from "./resume-mock";

/**
 * Above-the-fold. Three jobs, in order: say what this is in one line, give one
 * unmistakable primary action, and show the product rather than describe it.
 *
 * The whole section is server-rendered — the entrance animations come from the
 * shared motion wrappers, which are the only client components on the LCP path.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Backdrop. `-z-10` + pointer-events-none so none of it can eat a click. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-pattern [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)] opacity-[0.55]" />
        <div className="absolute -top-40 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.62_0.2_285/0.22),transparent)] blur-2xl" />
        <div className="absolute top-20 -right-32 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,oklch(0.6_0.22_330/0.16),transparent)] blur-2xl" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <FadeUp>
            <Link
              href={routes.templates}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur transition-colors outline-none hover:border-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="size-3.5 text-brand" />
              20 templates, ATS-safe by default
              <ArrowRight className="size-3" />
            </Link>
          </FadeUp>

          <FadeUp delay={0.06} className="mt-7">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
              The resume that gets read,{" "}
              <span className="text-gradient-brand">written with you</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.12} className="mt-6">
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Draft it, sharpen every bullet with AI you stay in control of, score it against the
              job description, and export a PDF that applicant tracking systems can actually read.
            </p>
          </FadeUp>

          <FadeUp delay={0.18} className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink size="xl" variant="brand" href={routes.signup}>
              Build my resume
              <ArrowRight data-icon="inline-end" />
            </ButtonLink>
            <ButtonLink size="xl" variant="outline" href={routes.templates}>
              See the templates
            </ButtonLink>
          </FadeUp>

          <Stagger
            whenInView
            delay={0.24}
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start"
          >
            {HERO_PROOF.map((item) => (
              <StaggerItem key={item} className="flex items-center gap-1.5">
                <Check className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                {item}
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* Product shot. Hidden below `sm` — a 240px-wide A4 page is illegible
            noise, and dropping it keeps mobile LCP to text only. */}
        <FadeUp delay={0.1} distance={20} className="relative hidden sm:block">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/25 to-brand/5 blur-2xl" />
          <div className="relative rounded-2xl border border-border/60 bg-card/70 p-3 shadow-xl backdrop-blur">
            <ResumeMock />
          </div>
          <ScoreChip className="absolute -bottom-5 -left-5 sm:-left-8" />
        </FadeUp>
      </div>
    </section>
  );
}
