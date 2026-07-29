"use client";

/**
 * The gallery's controls. Every one writes to the URL and nothing else — the grid is
 * server-rendered from `searchParams`, so the URL is the only state, and a filtered
 * gallery is a link somebody can send.
 *
 * Typing uses `router.replace` so a search does not bury the page under a history entry
 * per keystroke; picking a category or toggling favourites uses `router.push`, because
 * those are decisions Back should undo.
 *
 * Categories are chips rather than a `Select`: there are ten of them with counts, and the
 * counts are the useful part — hidden inside a closed dropdown they may as well not exist.
 * Each chip is a real `<button aria-pressed>` and not a link, because `aria-pressed` is
 * invalid on a link: a link goes somewhere, and this changes a filter's state. That the
 * change happens to be a navigation is an implementation detail.
 */

import { Loader2, Search, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

import { templateGalleryHref } from "../lib/gallery-url";
import type { GalleryCategoryOption } from "../lib/gallery";
import {
  DEFAULT_TEMPLATE_GALLERY_FILTERS,
  hasActiveTemplateFilters,
  TEMPLATE_SEARCH_MAX,
  type TemplateGalleryFilters,
} from "../schema/template-schema";

/** Long enough that a fast typist produces one navigation, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

export interface TemplateGalleryFiltersProps {
  filters: TemplateGalleryFilters;
  categories: GalleryCategoryOption[];
}

export function TemplateGalleryFilters({ filters, categories }: TemplateGalleryFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);

  // Re-sync when the URL changes from somewhere else — a "Clear" click, the back button,
  // a link into a category. Without this the box keeps stale text after the gallery it was
  // filtering has already been reset.
  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (search === filters.q) {
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(templateGalleryHref(filters, { q: search }), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters, router, search]);

  function navigate(patch: Partial<TemplateGalleryFilters>) {
    startTransition(() => {
      router.push(templateGalleryHref(filters, patch), { scroll: false });
    });
  }

  const isFiltered = hasActiveTemplateFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="rounded-full bg-card/60 shadow-xs backdrop-blur-xs transition-all duration-200 sm:max-w-xs">
          <InputGroupAddon>
            {pending ? <Loader2 className="animate-spin" /> : <Search />}
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            maxLength={TEMPLATE_SEARCH_MAX}
            placeholder="Search templates…"
            aria-label="Search templates"
            onChange={(event) => setSearch(event.target.value)}
          />
          {search.length > 0 ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            variant={filters.favorites ? "secondary" : "outline"}
            aria-pressed={filters.favorites}
            onClick={() => navigate({ favorites: !filters.favorites })}
          >
            <Star
              data-icon="inline-start"
              className={cn(filters.favorites && "fill-current text-brand")}
            />
            Favourites
          </Button>

          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(DEFAULT_TEMPLATE_GALLERY_FILTERS)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* A group, so a screen reader hears "Filter by category" once rather than eleven
          unrelated toggle buttons. */}
      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
        <CategoryChip
          label="All"
          isActive={filters.category === ""}
          onClick={() => navigate({ category: "" })}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.value}
            label={category.label}
            count={category.count}
            isActive={filters.category === category.value}
            // Clicking the active chip clears it, which is what a pressed toggle is
            // expected to do — otherwise the only way back to "All" is the All chip.
            onClick={() =>
              navigate({ category: filters.category === category.value ? "" : category.value })
            }
          />
        ))}
      </div>
    </div>
  );
}

interface CategoryChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

function CategoryChip({ label, count, isActive, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        isActive
          ? "border-brand/50 bg-brand/10 text-brand"
          : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {label}
      {count === undefined ? null : (
        <span
          className={cn("text-[10px]", isActive ? "text-brand/70" : "text-muted-foreground/70")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
