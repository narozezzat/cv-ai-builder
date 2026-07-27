"use client";

import {
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState, type CSSProperties, type ComponentType } from "react";
import { toast } from "sonner";

import { ButtonLink, ConfirmDialog, IconButton } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type FolderSummary } from "@/types/db";

import { deleteFolderAction } from "../actions/resume-actions";
import { resumeListHref } from "../lib/resume-list-url";
import { UNFILED_FOLDER, type ResumeListFilters } from "../schema/resume-schema";

import { FolderFormDialog } from "./folder-form-dialog";

interface FolderNavProps {
  folders: FolderSummary[];
  filters: ResumeListFilters;
  /** Total active resumes, for the "All resumes" count. */
  totalCount: number;
  unfiledCount: number;
}

/**
 * Folder rail beside the grid.
 *
 * Links, not buttons: a folder is a distinct, shareable view of the list, so it
 * gets a URL. The per-folder menu is a sibling control rather than nested inside
 * the link — interactive elements cannot be nested, and a rename button inside an
 * anchor would navigate on activation.
 */
export function FolderNav({ folders, filters, totalCount, unfiledCount }: FolderNavProps) {
  const [createOpen, setCreateOpen] = useState(false);
  // One dialog reused for whichever folder is being edited: mounting a dialog per
  // folder means N hidden dialogs in the tree for a list that can grow.
  const [editing, setEditing] = useState<FolderSummary | null>(null);
  const [deleting, setDeleting] = useState<FolderSummary | null>(null);

  const activeFolder = filters.folderId;

  async function confirmDelete() {
    if (!deleting) return;

    const result = await deleteFolderAction({ folderId: deleting.id });

    if (isActionFailure(result)) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message ?? "Folder deleted.");
    setDeleting(null);
  }

  return (
    <nav aria-label="Folders" className="space-y-1">
      <FolderLink
        href={resumeListHref(filters, { folderId: "" })}
        active={activeFolder.length === 0}
        icon={Layers}
        label="All resumes"
        count={totalCount}
      />

      <FolderLink
        href={resumeListHref(filters, { folderId: UNFILED_FOLDER })}
        active={activeFolder === UNFILED_FOLDER}
        icon={Folder}
        label="Unfiled"
        count={unfiledCount}
      />

      {folders.length > 0 ? (
        <ul className="space-y-1 pt-1">
          {folders.map((folder) => {
            const active = activeFolder === folder.id;

            return (
              <li key={folder.id} className="group/folder relative">
                <FolderLink
                  href={resumeListHref(filters, { folderId: folder.id })}
                  active={active}
                  icon={active ? FolderOpen : Folder}
                  label={folder.name}
                  count={folder.resumeCount}
                  color={folder.color}
                  className="pr-9"
                />

                <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity group-hover/folder:opacity-100 focus-within:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <IconButton
                          size="icon-xs"
                          label={`Actions for ${folder.name}`}
                          tooltip={false}
                          icon={<MoreHorizontal />}
                        />
                      }
                    />
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setEditing(folder)}>
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(folder)}>
                        <Trash2 />
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setCreateOpen(true)}
      >
        <FolderPlus data-icon="inline-start" />
        New folder
      </Button>

      <FolderFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <FolderFormDialog
        // Remount per folder so the form's `defaultValues` are the ones being
        // edited rather than whatever the previous open left behind.
        key={editing?.id ?? "none"}
        folder={editing ? { id: editing.id, name: editing.name } : undefined}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        icon={Trash2}
        tone="destructive"
        title="Delete folder?"
        description={
          deleting
            ? `"${deleting.name}" is removed. The ${deleting.resumeCount} resume${
                deleting.resumeCount === 1 ? "" : "s"
              } inside become unfiled — nothing is deleted.`
            : undefined
        }
        confirmLabel="Delete folder"
        onConfirm={confirmDelete}
      />
    </nav>
  );
}

interface FolderLinkProps {
  href: string;
  active: boolean;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  label: string;
  count: number;
  /** Folder tint. Absent for the built-in views. */
  color?: string | null;
  className?: string;
}

function FolderLink({ href, active, icon: Icon, label, count, color, className }: FolderLinkProps) {
  return (
    <ButtonLink
      href={href}
      scroll={false}
      variant="ghost"
      size="sm"
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full justify-start font-normal",
        active && "bg-accent font-medium text-accent-foreground",
        className,
      )}
    >
      <Icon
        data-icon="inline-start"
        className={cn(!active && "text-muted-foreground")}
        // Inline because the value is user data: a folder colour cannot be a
        // Tailwind class, and `style` is the only way to apply an arbitrary one.
        // Safe by construction — `folders.color` carries a
        // `check (color ~ '^#[0-9a-fA-F]{6}$')` constraint, so nothing else can
        // reach this attribute.
        {...(color ? { style: { color } } : {})}
      />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </ButtonLink>
  );
}
