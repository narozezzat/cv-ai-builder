import { Stagger, StaggerItem } from "@/components/shared";

import { STEPS } from "../content";
import { Section } from "./section";

/**
 * Three steps, numbered, connected by a rule on desktop.
 *
 * The connector is a pseudo-element on each item rather than a separate absolute
 * layer, so it cannot drift out of alignment when the column widths change; the
 * last item's connector is suppressed with `last:before:hidden`.
 */
export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Three steps to something you would send"
      description="No blank page, no formatting fights, no guessing whether it will survive the screener."
    >
      <Stagger whenInView stagger={0.1} className="grid gap-10 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, index) => (
          <StaggerItem
            key={step.title}
            className="relative flex flex-col gap-4 before:bg-border md:before:absolute md:before:top-5 md:before:left-12 md:before:h-px md:before:w-[calc(100%-3rem)] md:last:before:hidden"
          >
            <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-sm font-semibold text-brand tabular-nums shadow-xs">
              {index + 1}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
