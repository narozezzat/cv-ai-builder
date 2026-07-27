"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Form, FormError, FormField, SubmitButton, runAction } from "@/components/shared/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { createFolderAction, renameFolderAction } from "../actions/resume-actions";
import { FOLDER_NAME_MAX, type FolderNameInput, createFolderSchema } from "../schema/resume-schema";

interface FolderFormDialogProps {
  /**
   * The folder being renamed. Omit to create a new one — one dialog for both
   * because they differ only in which action runs and what the heading says, and
   * two near-identical dialogs would drift.
   */
  folder?: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FolderFormDialog({ folder, open, onOpenChange }: FolderFormDialogProps) {
  const editing = folder !== undefined;

  const form = useForm<FolderNameInput>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { name: folder?.name ?? "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: folder?.name ?? "" });
    }
  }, [folder?.name, form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form
          form={form}
          onSubmit={(values) =>
            runAction(
              form,
              () =>
                folder
                  ? renameFolderAction({ folderId: folder.id, name: values.name })
                  : createFolderAction({ name: values.name }),
              (result) => {
                toast.success(result.message ?? (editing ? "Folder renamed." : "Folder created."));
                onOpenChange(false);
              },
            )
          }
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Rename folder" : "New folder"}</DialogTitle>
            <DialogDescription>
              Folders group resumes on your dashboard. Deleting one never deletes the resumes inside
              it.
            </DialogDescription>
          </DialogHeader>

          <FormField<FolderNameInput, "name"> name="name" label="Folder name" required>
            {(field) => <Input {...field} maxLength={FOLDER_NAME_MAX} placeholder="Applications" />}
          </FormField>

          <FormError />

          <DialogFooter showCloseButton>
            <SubmitButton pendingLabel="Saving…">{editing ? "Save" : "Create folder"}</SubmitButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
