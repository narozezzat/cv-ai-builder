"use client";

import {
  Clock,
  Copy,
  Download,
  Eye,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Star,
  Tags,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, IconButton } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTemplateDefinition } from "@/features/templates";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { type FolderSummary, type ResumeSummary } from "@/types/db";
import { formatRelativeTime } from "@/utils/date";

import {
  duplicateResumeAction,
  moveResumeToFolderAction,
  setResumeFavoriteAction,
  trashResumeAction,
} from "../actions/resume-actions";
import { UNFILED_FOLDER } from "../schema/resume-schema";

import { RenameResumeDialog } from "./rename-resume-dialog";
import { ResumeTagsDialog } from "./resume-tags-dialog";

interface ResumeCardProps {
  resume: ResumeSummary;
  /** Every folder the user owns, for the move-to submenu. */
  folders: FolderSummary[];
}

/**
 * One resume in the dashboard grid.
 *
 * The whole card is not a link. A card-sized anchor swallows the favourite toggle
 * and the overflow menu — both of which are interactive controls that must not be
 * nested inside an `<a>` — so the title is the link and the rest of the card is a
 * container. `group-hover` on the card still gives the affordance of a clickable
 * tile without the invalid markup.
 *
 * Dialogs are driven by local `open` state rather than `trigger` props: a trigger
 * inside a `DropdownMenuItem` never opens, because activating the item unmounts
 * the menu — and the trigger with it — before the dialog can mount.
 */
export function ResumeCard({ resume, folders }: ResumeCardProps) {
  const [pending, startTransition] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  // Optimistic only for the star: it is the one action with no confirmation, no
  // navigation, and an instantly visible result, so waiting a round-trip to fill
  // an icon reads as a broken button.
  const [favorite, setFavorite] = useState(resume.is_favorite);

  const editedAt = formatRelativeTime(resume.last_edited_at);
  const templateDef = getTemplateDefinition(resume.template_id);

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);

    startTransition(async () => {
      const result = await setResumeFavoriteAction({ resumeId: resume.id, isFavorite: next });

      if (isActionFailure(result)) {
        setFavorite(!next);
        toast.error(result.error);
      }
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateResumeAction({ resumeId: resume.id });

      if (isActionFailure(result)) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Resume duplicated.");
    });
  }

  function moveTo(value: string) {
    const folderId = value === UNFILED_FOLDER ? null : value;

    if (folderId === resume.folder_id) {
      return;
    }

    startTransition(async () => {
      const result = await moveResumeToFolderAction({ resumeId: resume.id, folderId });

      if (isActionFailure(result)) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Resume moved.");
    });
  }

  // Returned, not awaited-and-discarded: `ConfirmDialog` keeps its pending state
  // for as long as this promise is unresolved and closes only once it settles.
  async function trash() {
    const result = await trashResumeAction({ resumeId: resume.id });

    if (isActionFailure(result)) {
      toast.error(result.error);
      // Thrown so the dialog stays open for a retry — it treats a rejection as
      // "did not happen" and leaves itself mounted.
      throw new Error(result.error);
    }

    toast.success(result.message ?? "Moved to trash.");
  }

  return (
    <>
      <Card
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 dark:hover:shadow-brand/10",
          pending && "pointer-events-none opacity-70",
        )}
      >
        {/* Document Visual Thumbnail Container */}
        <div className="relative flex aspect-16/10 w-full items-center justify-center overflow-hidden border-b border-border/40 bg-linear-to-b from-muted/50 via-muted/30 to-muted/70 p-3 transition-colors select-none group-hover:bg-muted/60">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(var(--brand-oklch,0.6_0.2_270)/0.08),transparent_75%)]"
          />

          {/* Mini Document Paper Preview */}
          <div
            aria-hidden
            className="relative -bottom-8 flex h-[140%] w-[78%] flex-col gap-2 overflow-hidden rounded-t-lg border border-border/70 bg-card p-3 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:shadow-xl"
          >
            {/* Mini Header */}
            <div className="flex items-center gap-2">
              <div className="size-5 shrink-0 rounded-full border border-brand/40 bg-brand/25" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-16 rounded-full bg-brand/70" />
                <div className="h-1 w-24 rounded-full bg-muted-foreground/30" />
              </div>
            </div>

            <div className="my-0.5 h-px w-full bg-border/60" />

            {/* Section 1 */}
            <div className="space-y-1.5">
              <div className="h-1.5 w-12 rounded-full bg-foreground/50 font-medium" />
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-muted-foreground/25" />
                <div className="h-1 w-[85%] rounded-full bg-muted-foreground/20" />
                <div className="h-1 w-[92%] rounded-full bg-muted-foreground/20" />
              </div>
            </div>

            {/* Section 2 */}
            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 w-10 rounded-full bg-foreground/50 font-medium" />
              <div className="space-y-1">
                <div className="h-1 w-[90%] rounded-full bg-muted-foreground/25" />
                <div className="h-1 w-[75%] rounded-full bg-muted-foreground/20" />
              </div>
            </div>
          </div>

          {/* Top Left Template Pill */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs backdrop-blur-md transition-colors group-hover:border-brand/40 group-hover:text-foreground">
            <Sparkles className="size-3 text-brand" />
            <span>{templateDef.name}</span>
          </div>

          {/* Top Right Floating Action Controls */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <IconButton
              size="icon-xs"
              variant="ghost"
              label={favorite ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={favorite}
              onClick={toggleFavorite}
              className={cn(
                "size-7 rounded-full border border-border/50 bg-background/80 shadow-xs backdrop-blur-md transition-all hover:scale-105 hover:bg-background active:scale-95",
                favorite && "border-brand/40 bg-brand/10 text-brand hover:bg-brand/20",
              )}
              icon={
                <Star
                  className={cn(
                    "size-3.5",
                    favorite
                      ? "fill-brand text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                />
              }
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <IconButton
                    size="icon-xs"
                    variant="ghost"
                    label="Resume actions"
                    tooltip={false}
                    className="size-7 rounded-full border border-border/50 bg-background/80 text-muted-foreground shadow-xs backdrop-blur-md transition-all hover:scale-105 hover:bg-background hover:text-foreground active:scale-95"
                    icon={<MoreHorizontal className="size-3.5" />}
                  />
                }
              />
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem render={<Link href={routes.builder(resume.id)} />}>
                  <Pencil />
                  Open in editor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTagsOpen(true)}>
                  <Tags />
                  Edit tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={duplicate}>
                  <Copy />
                  Duplicate
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput />
                    Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuRadioGroup
                      value={resume.folder_id ?? UNFILED_FOLDER}
                      onValueChange={(value) => moveTo(String(value))}
                    >
                      <DropdownMenuRadioItem value={UNFILED_FOLDER}>
                        No folder
                      </DropdownMenuRadioItem>
                      {folders.map((folder) => (
                        <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem variant="destructive" onClick={() => setTrashOpen(true)}>
                  <Trash2 />
                  Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick Hover Action Overlay */}
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-background/40 p-4 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
            <Link
              href={routes.builder(resume.id)}
              className="inline-flex scale-95 items-center gap-2 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-medium text-brand-foreground shadow-md transition-all duration-200 group-hover:scale-100 hover:bg-brand/90"
            >
              <Pencil className="size-3.5" />
              <span>Open Editor</span>
            </Link>
          </div>
        </div>

        <CardHeader className="space-y-1 p-4 pb-2">
          <CardTitle className="text-base leading-snug font-semibold tracking-tight">
            <Link
              href={routes.builder(resume.id)}
              className="line-clamp-1 block rounded-xs transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {resume.title}
            </Link>
          </CardTitle>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3 shrink-0 text-muted-foreground/70" />
            {editedAt ? (
              <>
                Edited{" "}
                <time dateTime={resume.last_edited_at} suppressHydrationWarning>
                  {editedAt}
                </time>
              </>
            ) : (
              "Not edited yet"
            )}
          </p>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-end px-4 py-2">
          {resume.tags.length > 0 ? (
            <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
              {resume.tags.map((tag) => (
                <li key={tag}>
                  <Badge
                    variant="secondary"
                    className="bg-muted/60 px-2 py-0.5 text-[11px] font-normal text-muted-foreground hover:bg-muted"
                  >
                    #{tag}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium transition-colors hover:text-foreground">
              <Eye aria-hidden className="size-3.5 text-muted-foreground/70" />
              {resume.view_count}
              <span className="sr-only">views</span>
            </span>
            <span className="flex items-center gap-1 font-medium transition-colors hover:text-foreground">
              <Download aria-hidden className="size-3.5 text-muted-foreground/70" />
              {resume.download_count}
              <span className="sr-only">downloads</span>
            </span>
          </div>

          {resume.visibility !== "private" ? (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400"
            >
              {resume.visibility}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-border/60 px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase"
            >
              Private
            </Badge>
          )}
        </CardFooter>
      </Card>

      <RenameResumeDialog
        resumeId={resume.id}
        title={resume.title}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <ResumeTagsDialog
        resumeId={resume.id}
        tags={resume.tags}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
      />

      <ConfirmDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        icon={Trash2}
        tone="destructive"
        title="Move to trash?"
        description={`"${resume.title}" moves to the trash. You can restore it from there, or delete it permanently.`}
        confirmLabel="Move to trash"
        onConfirm={trash}
      />
    </>
  );
}
