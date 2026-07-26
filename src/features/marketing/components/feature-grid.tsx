import { Stagger, StaggerItem } from "@/components/shared";
import { cn } from "@/lib/utils";

import { FEATURES, type FeatureItem } from "../content";
import { Section } from "./section";

function FeatureCard({ item }: { item: FeatureItem }) {
  const Icon = item.icon;

  return (
    <StaggerItem
      className={cn(
        // `group` so the icon plate can react to a hover on the whole card.
        "group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm transition-colors hover:border-border",
        item.wide && "md:col-span-2",
      )}
    >
      {/* Hover sheen. Separate layer so it fades without repainting the text. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/6 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background text-brand shadow-xs transition-transform duration-300 group-hover:-translate-y-0.5">
        <Icon className="size-[1.15rem]" />
      </div>
      <div className="relative space-y-2">
        <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      </div>
    </StaggerItem>
  );
}

export function FeatureGrid() {
  return (
    <Section
      id="features"
      eyebrow="Everything in one place"
      title="A builder that does the hard parts for you"
      description="Writing, formatting, targeting, and exporting are one workflow here — not four tools and a copy-paste between them."
    >
      <Stagger whenInView stagger={0.05} className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map((item) => (
          <FeatureCard key={item.title} item={item} />
        ))}
      </Stagger>
    </Section>
  );
}
