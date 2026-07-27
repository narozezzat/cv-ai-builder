"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Form, FormError, FormField, SubmitButton, runAction } from "@/components/shared/form";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { setResumeTagsAction } from "../actions/resume-actions";
import { RESUME_TAG_LIMIT, RESUME_TAG_MAX, parseTagInput } from "../schema/resume-schema";

/**
 * The form's shape is a single comma-separated string, not `string[]`.
 *
 * A tag *editor* built from chips and a hidden array would be a nicer widget and a
 * worse form: one text input is keyboard-native, pasteable, and needs no custom
 * focus management. `parseTagInput` is the same normaliser `tagsSchema` runs
 * server-side, so what the user sees counted here is what gets stored.
 */
const tagsFormSchema = z.object({
  tags: z
    .string()
    .max(
      // Generous: the real constraints are per-tag length and tag count, both
      // checked below. This only stops a pathological paste.
      RESUME_TAG_MAX * RESUME_TAG_LIMIT * 2,
      "That is more text than the tag list can hold.",
    )
    .refine(
      (value) => parseTagInput(value).length <= RESUME_TAG_LIMIT,
      `Use at most ${RESUME_TAG_LIMIT} tags.`,
    )
    .refine(
      (value) => parseTagInput(value).every((tag) => tag.length <= RESUME_TAG_MAX),
      `Each tag must be ${RESUME_TAG_MAX} characters or fewer.`,
    ),
});

type TagsFormInput = z.infer<typeof tagsFormSchema>;

interface ResumeTagsDialogProps {
  resumeId: string;
  tags: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeTagsDialog({ resumeId, tags, open, onOpenChange }: ResumeTagsDialogProps) {
  const form = useForm<TagsFormInput>({
    resolver: zodResolver(tagsFormSchema),
    defaultValues: { tags: tags.join(", ") },
    mode: "onBlur",
  });

  // Same reason as the rename dialog: reopening must not resurrect abandoned text,
  // and `reset` beats remounting because it preserves the close animation.
  useEffect(() => {
    if (open) {
      form.reset({ tags: tags.join(", ") });
    }
  }, [form, open, tags]);

  const preview = parseTagInput(form.watch("tags"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form
          form={form}
          onSubmit={(values) =>
            runAction(
              form,
              () => setResumeTagsAction({ resumeId, tags: parseTagInput(values.tags) }),
              (result) => {
                toast.success(result.message ?? "Tags updated.");
                onOpenChange(false);
              },
            )
          }
        >
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>
              Separate tags with commas. Tags are private and only used for filtering your
              dashboard.
            </DialogDescription>
          </DialogHeader>

          <FormField<TagsFormInput, "tags">
            name="tags"
            label="Tags"
            description={`${preview.length} of ${RESUME_TAG_LIMIT} used.`}
          >
            {(field) => (
              <Input
                {...field}
                placeholder="frontend, senior, remote"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </FormField>

          {/*
            Live echo of the normalised result: duplicates and stray whitespace are
            removed server-side, and a user who typed "React, react" should see one
            chip before submitting rather than wonder where the second went.
          */}
          {preview.length > 0 ? (
            <ul aria-label="Tag preview" className="flex flex-wrap gap-1.5">
              {preview.map((tag) => (
                <li key={tag.toLowerCase()}>
                  <Badge variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <FormError />

          <DialogFooter showCloseButton>
            <SubmitButton pendingLabel="Saving…">Save tags</SubmitButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
