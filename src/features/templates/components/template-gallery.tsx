import { LayoutTemplate, SearchX, Star } from "lucide-react";

import { ButtonLink, EmptyState, Stagger, StaggerItem } from "@/components/shared";

import { templateGalleryHref } from "../lib/gallery-url";
import type { GalleryTemplate } from "../lib/gallery";
import {
  DEFAULT_TEMPLATE_GALLERY_FILTERS,
  hasActiveTemplateFilters,
  type TemplateGalleryFilters,
} from "../schema/template-schema";

import { TemplateCard } from "./template-card";

export interface TemplateGalleryProps {
  templates: GalleryTemplate[];
  filters: TemplateGalleryFilters;
}

/**
 * The grid, plus the three ways it can be empty.
 *
 * No `"use client"`: the star and the create button are the interactive parts and carry
 * their own directive, so the grid — and every thumbnail in it — renders on the server.
 *
 * The empty states are different problems and must not share a message. "No favourites"
 * is a state the user created and can leave; "nothing matches" is a search to widen; and
 * an unfiltered gallery with nothing in it means the catalogue is empty or unreachable,
 * which is not the user's doing and has no action they could take.
 */
export function TemplateGallery({ templates, filters }: TemplateGalleryProps) {
  if (templates.length === 0) {
    const clearFilters = (
      <ButtonLink
        href={templateGalleryHref(DEFAULT_TEMPLATE_GALLERY_FILTERS)}
        variant="outline"
        scroll={false}
      >
        Show all templates
      </ButtonLink>
    );

    // Checked before the general filtered case: a starred-only gallery with no stars is
    // the most likely empty state here, and "no templates match your filters" would be a
    // confusing way to say "you haven't starred anything".
    if (filters.favorites && filters.q === "" && filters.category === "") {
      return (
        <EmptyState
          icon={Star}
          title="No favourite templates yet"
          description="Star a template from the gallery and it will be waiting here the next time you start a resume."
          action={clearFilters}
        />
      );
    }

    if (hasActiveTemplateFilters(filters)) {
      return (
        <EmptyState
          icon={SearchX}
          title="No templates match those filters"
          description="Try a different search term or category, or clear the filters to browse everything."
          action={clearFilters}
        />
      );
    }

    return (
      <EmptyState
        icon={LayoutTemplate}
        title="No templates available"
        description="The template catalogue could not be loaded. Refresh the page — if it stays empty, it is on our side, not yours."
      />
    );
  }

  return (
    <Stagger
      as="ul"
      aria-label="Resume templates"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {templates.map(({ definition, isFavorite }) => (
        <StaggerItem as="li" key={definition.id} className="flex">
          <TemplateCard definition={definition} isFavorite={isFavorite} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
