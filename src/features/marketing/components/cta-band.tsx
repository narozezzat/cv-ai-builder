import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FadeUp } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** Closing call to action. Last thing before the footer, so it repeats the one action that matters. */
export function CtaBand() {
  return (
    <section className="px-6 pb-24 sm:pb-32">
      <FadeUp
        whenInView
        className="relative isolate mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 px-6 py-16 text-center sm:px-16 sm:py-20"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,oklch(0.42_0.18_285),oklch(0.38_0.2_320))]"
        />
        {/* Animated aurora wash over the gradient. The utility already respects
            `prefers-reduced-motion` via the base layer in globals.css. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 animate-aurora bg-[radial-gradient(60%_60%_at_20%_20%,oklch(0.7_0.2_200/0.35),transparent),radial-gradient(50%_50%_at_80%_70%,oklch(0.7_0.22_340/0.35),transparent)] opacity-80"
        />

        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your next role is one good resume away
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
          Start free. Import what you have, let the AI tighten it, and export a PDF in the next ten
          minutes.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            size="xl"
            className="bg-white text-neutral-950 hover:bg-white/90"
            render={<Link href={routes.signup} />}
          >
            Create free account
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            size="xl"
            variant="glass"
            className="text-white"
            render={<Link href={routes.login} />}
          >
            I already have one
          </Button>
        </div>
      </FadeUp>
    </section>
  );
}
