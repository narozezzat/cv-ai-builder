/**
 * One template in the gallery.
 *
 * A Server Component with two client leaves — the star and the create button. That split
 * is the whole point: the expensive part of this card is the thumbnail, twenty rendered
 * resume pages, and it stays on the server. Making the card itself a client component to
 * hold the star would ship the renderer, the layouts, and the twenty token configs to the
 * browser for a button.
 *
 * The card is not a link. Nothing about a template is navigable — you star it or you start
 * a resume from it — so there is no anchor to swallow the two controls, and both sit as
 * ordinary siblings.
 */

import { Palette } from "lucide-react";

import { CreateResumeButton } from "@/features/resume";

import { TEMPLATE_CATEGORY_LABELS, type TemplateDefinition } from "../lib/template-types";

import { TemplateFavoriteButton } from "./template-favorite-button";
import { TemplateThumbnail } from "./template-thumbnail";

/**
 * Palettes shown as dots. Four is what fits beside the name at the narrowest card width;
 * the rest are counted in the "+n" that follows.
 */
const VISIBLE_PALETTES = 4;

export interface TemplateCardProps {
  definition: TemplateDefinition;
  isFavorite: boolean;
}

export function TemplateCard({ definition, isFavorite }: TemplateCardProps) {
  const palettes = definition.palettes.slice(0, VISIBLE_PALETTES);
  const hiddenPalettes = definition.palettes.length - palettes.length;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 dark:hover:shadow-brand/10">
      <div className="relative overflow-hidden border-b border-border/40 bg-muted/40">
        <TemplateThumbnail
          templateId={definition.id}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <div className="absolute top-3 right-3 z-10">
          <TemplateFavoriteButton
            templateId={definition.id}
            templateName={definition.name}
            isFavorite={isFavorite}
          />
        </div>

        <span className="absolute top-3 left-3 z-10 rounded-full border border-border/50 bg-background/80 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase shadow-xs backdrop-blur-md">
          {TEMPLATE_CATEGORY_LABELS[definition.category]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{definition.name}</h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {definition.description}
          </p>
        </div>

        {/* Palette swatches are decoration for a sighted user and noise for a screen
            reader — the count beside them is the part worth announcing, so the dots are
            hidden and the label carries the number. */}
        <div className="flex items-center gap-1.5">
          <Palette aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="sr-only">
            {definition.palettes.length} colour{definition.palettes.length === 1 ? "" : "s"}
          </span>
          <div aria-hidden className="flex items-center gap-1">
            {palettes.map((palette) => (
              <span
                key={palette.id}
                title={palette.name}
                className="size-3 rounded-full ring-1 ring-border/60 ring-inset"
                style={{ backgroundColor: palette.accent }}
              />
            ))}
            {hiddenPalettes > 0 && (
              <span className="text-[10px] text-muted-foreground">+{hiddenPalettes}</span>
            )}
          </div>
        </div>

        <CreateResumeButton
          templateId={definition.id}
          label="Use this template"
          variant="outline"
          size="sm"
          className="mt-auto w-full group-hover:border-brand/50 group-hover:text-brand"
        />
      </div>
    </div>
  );
}
