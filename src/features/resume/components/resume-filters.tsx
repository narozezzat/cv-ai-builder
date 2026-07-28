"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type ResumeTagSummary } from "@/types/db";

import { resumeListHref } from "../lib/resume-list-url";
import {
  RESUME_SEARCH_MAX,
  RESUME_SORTS,
  RESUME_SORT_LABELS,
  type ResumeListFilters,
  type ResumeSort,
  hasActiveResumeFilters,
} from "../schema/resume-schema";

/**
 * Base UI's `Select` treats `""` as "no value chosen" and renders the placeholder,
 * which is exactly wrong for a filter whose "no filter" state is a real, selectable
 * option. A sentinel keeps "All tags" a first-class item.
 */
const ALL_TAGS = "__all__";

/** Long enough that a fast typist produces one navigation, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

interface ResumeFiltersProps {
  filters: ResumeListFilters;
  tags: ResumeTagSummary[];
}

/**
 * The dashboard's list controls. Every control writes to the URL and nothing else —
 * the grid is server-rendered from `searchParams`, so the URL is the only state.
 *
 * Typing uses `router.replace` so a search doesn't bury the previous page under
 * twelve history entries; discrete choices use `router.push` so Back undoes them.
 */
export function ResumeFilters({ filters, tags }: ResumeFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);

  // Re-sync when the URL changes from somewhere else — a "clear filters" click, a
  // folder link, the back button. Without this the box keeps stale text after the
  // list it was filtering has already been reset.
  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (search === filters.q) {
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(resumeListHref(filters, { q: search }), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters, router, search]);

  function navigate(patch: Partial<ResumeListFilters>) {
    startTransition(() => {
      router.push(resumeListHref(filters, patch), { scroll: false });
    });
  }

  const isFiltered = hasActiveResumeFilters(filters);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup className="rounded-full bg-card/60 shadow-xs backdrop-blur-xs transition-all duration-200 sm:max-w-xs">
        <InputGroupAddon>
          {pending ? <Loader2 className="animate-spin" /> : <Search />}
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={search}
          maxLength={RESUME_SEARCH_MAX}
          placeholder="Search resumes…"
          aria-label="Search resumes"
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

      <div className="flex flex-wrap items-center gap-2">
        {tags.length > 0 ? (
          <Select
            value={filters.tag.length > 0 ? filters.tag : ALL_TAGS}
            onValueChange={(value) => navigate({ tag: value === ALL_TAGS ? "" : (value ?? "") })}
          >
            <SelectTrigger aria-label="Filter by tag">
              <SelectValue>
                {(selected) => (selected === ALL_TAGS ? "All tags" : String(selected))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS}>All tags</SelectItem>
              {tags.map(({ tag, count }) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                  <span className="text-muted-foreground">{count}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={filters.sort}
          onValueChange={(value) => {
            if (value !== null) {
              navigate({ sort: value });
            }
          }}
        >
          <SelectTrigger aria-label="Sort resumes">
            <SelectValue>
              {(selected) => RESUME_SORT_LABELS[selected as ResumeSort] ?? "Sort"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RESUME_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {RESUME_SORT_LABELS[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/*
          A real button, not a link: `aria-pressed` communicates the on/off nature
          of the filter, and it is invalid on a link — a link goes somewhere, a
          toggle changes state. The navigation is an implementation detail.
        */}
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
            onClick={() =>
              navigate({ q: "", tag: "", folderId: "", favorites: false, sort: "recent" })
            }
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
