"use client";

import {
  Copy,
  Download,
  Eye,
  FolderInput,
  MoreHorizontal,
  Pencil,
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
          "group relative w-full gap-0 transition-shadow hover:shadow-md",
          pending && "opacity-70",
        )}
      >
        <CardHeader className="gap-1.5">
          <CardTitle className="pr-16 text-base leading-snug">
            <Link
              href={routes.builder(resume.id)}
              className="rounded-sm hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {resume.title}
            </Link>
          </CardTitle>

          <p className="text-xs text-muted-foreground">
            {editedAt ? (
              <>
                Edited <time dateTime={resume.last_edited_at}>{editedAt}</time>
              </>
            ) : (
              "Not edited yet"
            )}
          </p>

          {/*
            Absolutely positioned rather than a `CardAction` grid cell, because the
            title above is allowed to wrap to two lines and the controls must not
            move when it does.
          */}
          <div className="absolute top-4 right-4 flex items-center gap-0.5">
            <IconButton
              size="icon-sm"
              label={favorite ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={favorite}
              onClick={toggleFavorite}
              icon={<Star className={cn(favorite && "fill-brand text-brand")} />}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <IconButton
                    size="icon-sm"
                    label="Resume actions"
                    tooltip={false}
                    icon={<MoreHorizontal />}
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
        </CardHeader>

        <CardContent className="flex-1">
          {resume.tags.length > 0 ? (
            <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
              {resume.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>

        <CardFooter className="gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye aria-hidden className="size-3.5" />
            {resume.view_count}
            <span className="sr-only">views</span>
          </span>
          <span className="flex items-center gap-1">
            <Download aria-hidden className="size-3.5" />
            {resume.download_count}
            <span className="sr-only">downloads</span>
          </span>
          {resume.visibility !== "private" ? (
            <Badge variant="outline" className="ml-auto capitalize">
              {resume.visibility}
            </Badge>
          ) : null}
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
