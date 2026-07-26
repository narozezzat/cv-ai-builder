import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Stagger, StaggerItem } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import { TEMPLATE_PREVIEWS, type TemplateLayoutPreview, type TemplatePreview } from "../content";
import { Section } from "./section";

/**
 * Abstract layout thumbnails.
 *
 * One `switch` over the layout primitives, drawn in CSS. This keeps the section
 * honest — each shape is a layout the engine really produces — without needing
 * 20 screenshots that would go stale the first time a template is tuned.
 */

function Bar({ w, accent, className }: { w: string; accent?: string; className?: string }) {
  return (
    <div
      className={className ?? "h-1 rounded-full"}
      style={{ width: w, backgroundColor: accent ?? "oklch(0.6 0 0 / 0.22)" }}
    />
  );
}

function Block({ accent }: { accent: string }) {
  return (
    <div className="space-y-1">
      <Bar w="42%" accent={accent} />
      <Bar w="100%" />
      <Bar w="85%" />
    </div>
  );
}

function LayoutSketch({ layout, accent }: { layout: TemplateLayoutPreview; accent: string }) {
  switch (layout) {
    case "single-column":
      return (
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <Bar w="46%" className="h-2 rounded-full" accent={accent} />
            <Bar w="62%" />
          </div>
          <Block accent={accent} />
          <Block accent={accent} />
          <Block accent={accent} />
        </div>
      );

    case "sidebar-left":
    case "sidebar-right":
      return (
        <div
          className={`flex h-full gap-3 p-4 ${layout === "sidebar-right" ? "flex-row-reverse" : ""}`}
        >
          <div
            className="w-1/3 shrink-0 rounded"
            // `color-mix` tints the accent without needing a second colour value
            // per template, so a palette stays a single source of truth.
            style={{ backgroundColor: `color-mix(in oklch, ${accent} 12%, transparent)` }}
          >
            <div className="space-y-1.5 p-2">
              <div className="size-5 rounded-full" style={{ backgroundColor: accent }} />
              <Bar w="80%" />
              <Bar w="60%" />
              <Bar w="70%" />
              <Bar w="50%" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <Bar w="60%" className="h-2 rounded-full" accent={accent} />
            <Block accent={accent} />
            <Block accent={accent} />
          </div>
        </div>
      );

    case "header-banner":
      return (
        <div className="h-full space-y-3">
          <div className="space-y-1.5 p-4 pb-3" style={{ backgroundColor: accent }}>
            <Bar w="50%" className="h-2 rounded-full bg-white/85" />
            <Bar w="70%" className="h-1 rounded-full bg-white/50" />
          </div>
          <div className="space-y-3 px-4 pb-4">
            <Block accent={accent} />
            <Block accent={accent} />
          </div>
        </div>
      );

    case "timeline-split":
      return (
        <div className="space-y-3 p-4">
          <Bar w="46%" className="h-2 rounded-full" accent={accent} />
          <div className="space-y-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-2">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
                  <div className="w-px flex-1 bg-black/10 dark:bg-white/10" />
                </div>
                <div className="flex-1 space-y-1">
                  <Bar w="55%" />
                  <Bar w="88%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "two-column":
      return (
        <div className="space-y-3 p-4">
          <Bar w="48%" className="h-2 rounded-full" accent={accent} />
          <div className="grid grid-cols-2 gap-3">
            <Block accent={accent} />
            <Block accent={accent} />
            <Block accent={accent} />
            <Block accent={accent} />
          </div>
        </div>
      );
  }
}

function TemplateCard({ item }: { item: TemplatePreview }) {
  return (
    <StaggerItem className="group">
      <div className="relative aspect-[1/1.3] overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs transition-all duration-300 group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-lg">
        <LayoutSketch layout={item.layout} accent={item.accent} />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground">{item.family}</span>
      </div>
    </StaggerItem>
  );
}

export function TemplateShowcase() {
  return (
    <Section
      id="templates"
      eyebrow="Templates"
      title="Twenty layouts. One document."
      description="Content and design are stored separately, so swapping template or palette re-renders what you already wrote — it never asks you to type it again."
    >
      <Stagger
        whenInView
        stagger={0.05}
        className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {TEMPLATE_PREVIEWS.map((item) => (
          <TemplateCard key={item.name} item={item} />
        ))}
      </Stagger>

      <div className="mt-12 flex justify-center">
        <Button variant="outline" size="lg" render={<Link href={routes.signup} />}>
          Browse all 20 templates
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </Section>
  );
}
