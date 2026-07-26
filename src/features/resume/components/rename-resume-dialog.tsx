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

import { renameResumeAction } from "../actions/resume-actions";
import {
  RESUME_TITLE_MAX,
  type RenameResumeInput,
  renameResumeSchema,
} from "../schema/resume-schema";

interface RenameResumeDialogProps {
  resumeId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameResumeDialog({
  resumeId,
  title,
  open,
  onOpenChange,
}: RenameResumeDialogProps) {
  const form = useForm<RenameResumeInput>({
    resolver: zodResolver(renameResumeSchema),
    defaultValues: { resumeId, title },
  });

  // Reopening after a cancelled edit must not show the abandoned text. `reset` on
  // open rather than `key`-remounting the dialog, so the close animation still runs.
  useEffect(() => {
    if (open) {
      form.reset({ resumeId, title });
    }
  }, [form, open, resumeId, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form
          form={form}
          onSubmit={(values) =>
            runAction(
              form,
              () => renameResumeAction(values),
              (result) => {
                toast.success(result.message ?? "Resume renamed.");
                onOpenChange(false);
              },
            )
          }
        >
          <DialogHeader>
            <DialogTitle>Rename resume</DialogTitle>
            <DialogDescription>
              Only you see this name — it is not part of the resume itself.
            </DialogDescription>
          </DialogHeader>

          <FormField<RenameResumeInput, "title"> name="title" label="Title" required>
            {(field) => <Input {...field} value={field.value ?? ""} maxLength={RESUME_TITLE_MAX} />}
          </FormField>

          <FormError />

          <DialogFooter showCloseButton>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
