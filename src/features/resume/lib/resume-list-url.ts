/**
 * Builds the dashboard list URL from a filter patch.
 *
 * The grid's filter state lives in the URL and nowhere else: the page is a Server
 * Component that reads `searchParams`, so the URL *is* the state — which also makes
 * a filtered view shareable, bookmarkable, and restored correctly by the back
 * button. A client-side store holding the same values would be a second source of
 * truth that the server could not see.
 *
 * Defaults are omitted rather than serialised, so the unfiltered view is a clean
 * `/dashboard/resumes` and `parseResumeListFilters` fills the rest in.
 */

import { routes } from "@/lib/routes";

import { type ResumeListFilters } from "../schema/resume-schema";

export function resumeListHref(
  filters: ResumeListFilters,
  patch: Partial<ResumeListFilters> = {},
): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  if (next.q.length > 0) {
    params.set("q", next.q);
  }

  if (next.tag.length > 0) {
    params.set("tag", next.tag);
  }

  if (next.folderId.length > 0) {
    params.set("folderId", next.folderId);
  }

  if (next.favorites) {
    params.set("favorites", "1");
  }

  if (next.sort !== "recent") {
    params.set("sort", next.sort);
  }

  const query = params.toString();

  return query.length > 0 ? `${routes.resumes}?${query}` : routes.resumes;
}
