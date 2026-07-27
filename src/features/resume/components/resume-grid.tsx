import { FileText, SearchX } from "lucide-react";

import { ButtonLink, EmptyState, Stagger, StaggerItem } from "@/components/shared";
import { type FolderSummary, type ResumeSummary } from "@/types/db";

import { resumeListHref } from "../lib/resume-list-url";
import {
  DEFAULT_RESUME_LIST_FILTERS,
  UNFILED_FOLDER,
  type ResumeListFilters,
  hasActiveResumeFilters,
} from "../schema/resume-schema";

import { CreateResumeButton } from "./create-resume-button";
import { ResumeCard } from "./resume-card";

interface ResumeGridProps {
  resumes: ResumeSummary[];
  folders: FolderSummary[];
  filters: ResumeListFilters;
}

/**
 * The grid, plus the two empty states it can land in.
 *
 * No `"use client"`: the cards are the interactive part and carry their own
 * directive, so the grid itself renders on the server and ships no JS for layout.
 *
 * The two empty states are genuinely different problems. "You have no resumes"
 * wants a create button; "your filters match nothing" wants a way back to the
 * unfiltered list — offering "create resume" there implies the user's work is
 * gone.
 */
export function ResumeGrid({ resumes, folders, filters }: ResumeGridProps) {
  if (resumes.length === 0) {
    return hasActiveResumeFilters(filters) ? (
      <EmptyState
        icon={SearchX}
        title="No resumes match those filters"
        description="Try a different search term, or clear the filters to see everything again."
        action={
          <ButtonLink
            href={resumeListHref(DEFAULT_RESUME_LIST_FILTERS)}
            variant="outline"
            scroll={false}
          >
            Clear filters
          </ButtonLink>
        }
      />
    ) : (
      <EmptyState
        icon={FileText}
        title="No resumes yet"
        description="Start from a blank document and pick a template as you go — you can switch templates at any time without losing content."
        action={<CreateResumeButton folderId={folderIdFromFilters(filters)} />}
      />
    );
  }

  return (
    <Stagger as="ul" aria-label="Your resumes" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {resumes.map((resume) => (
        <StaggerItem as="li" key={resume.id} className="flex">
          <ResumeCard resume={resume} folders={folders} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * A resume created from inside a folder view belongs in that folder.
 *
 * The "unfiled" sentinel is a view, not a folder id, so it maps back to `null`
 * rather than being passed through as a string the database would reject.
 */
function folderIdFromFilters(filters: ResumeListFilters): string | null {
  const isRealFolder = filters.folderId.length > 0 && filters.folderId !== UNFILED_FOLDER;

  return isRealFolder ? filters.folderId : null;
}
