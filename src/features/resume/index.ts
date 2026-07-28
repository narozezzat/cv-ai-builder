/**
 * Public surface of the resume feature.
 *
 * Same contract as the profile barrel: routes and other features reach this file and
 * nothing deeper. Queries are exported because a Server Component has to read the
 * rows it renders. Actions stay private — every one of them is called by a component
 * exported here, and a route inventing its own resume write is a route that will
 * forget the rate limit or the `deleted_at` guard.
 *
 * The store is exported because the editor's client components, the live preview, and
 * the shortcut layer all subscribe to the same instance; there is nothing to
 * encapsulate behind an action there.
 */

export { CreateResumeButton } from "./components/create-resume-button";
export { ResumeEditor, type ResumeEditorProps } from "./components/editor/resume-editor";
export { EmptyTrashButton } from "./components/empty-trash-button";
export { EmptyTrashSection, EmptyTrashSkeleton } from "./components/empty-trash-section";
export { FolderNav } from "./components/folder-nav";
export { FolderNavSection, FolderNavSkeleton } from "./components/folder-nav-section";
export { ResumeFilters } from "./components/resume-filters";
export { ResumeFiltersSection, ResumeFiltersSkeleton } from "./components/resume-filters-section";
export { ResumeGrid } from "./components/resume-grid";
export { ResumeGridSection, ResumeGridSkeleton } from "./components/resume-grid-section";
export { TrashCountBadge } from "./components/trash-count-badge";
export { TrashList } from "./components/trash-list";
export { TrashListSection, TrashListSkeleton } from "./components/trash-list-section";

export { resumeListHref } from "./lib/resume-list-url";

export { HISTORY_LIMITS } from "./store/history";
export {
  selectBasics,
  selectCanRedo,
  selectCanUndo,
  selectDocument,
  selectDraft,
  selectIsDirty,
  selectPage,
  selectSection,
  selectSections,
  selectTemplateId,
  selectTheme,
  useResumeStore,
  type InitializeResumeInput,
  type MarkSavedInput,
  type ResumeDraft,
  type ResumeEditorStore,
  type SaveStatus,
} from "./store/resume-store";

export {
  countTrashedResumes,
  getResumeCounts,
  getResumeForEditor,
  listFolders,
  listResumeTags,
  listResumes,
  listTrashedResumes,
  type ResumeEditorFailure,
  type ResumeEditorRecord,
  type ResumeEditorResult,
} from "./queries/resume-queries";

export {
  DEFAULT_RESUME_LIST_FILTERS,
  DEFAULT_RESUME_TITLE,
  RESUME_SEARCH_MAX,
  RESUME_SORTS,
  RESUME_SORT_LABELS,
  RESUME_TAG_LIMIT,
  RESUME_TAG_MAX,
  RESUME_TITLE_MAX,
  UNFILED_FOLDER,
  hasActiveResumeFilters,
  parseResumeListFilters,
  parseTagInput,
  type ResumeListFilters,
  type ResumeSort,
} from "./schema/resume-schema";
