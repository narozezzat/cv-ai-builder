"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { Button } from "@/components/ui/button";

import { emptyResumeTrashAction } from "../actions/resume-actions";

interface EmptyTrashButtonProps {
  count: number;
}

/**
 * Deletes every trashed resume.
 *
 * Uses `ConfirmDialog`'s own `trigger` — unlike the card menus, this button is not
 * inside a menu that unmounts on activation, so the trigger survives long enough
 * to open the dialog.
 */
export function EmptyTrashButton({ count }: EmptyTrashButtonProps) {
  async function emptyTrash() {
    const result = await emptyResumeTrashAction();

    if (isActionFailure(result)) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message ?? "Trash emptied.");
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" disabled={count === 0}>
          <Trash2 data-icon="inline-start" />
          Empty trash
        </Button>
      }
      icon={Trash2}
      tone="destructive"
      title="Empty the trash?"
      description={`${count} resume${count === 1 ? "" : "s"} and all their version history will be deleted for good. This cannot be undone.`}
      confirmLabel="Delete everything"
      onConfirm={emptyTrash}
    />
  );
}
