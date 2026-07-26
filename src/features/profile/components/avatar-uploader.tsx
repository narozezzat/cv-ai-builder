"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { Button } from "@/components/ui/button";

import { removeAvatarAction, uploadAvatarAction } from "../actions/profile-actions";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, validateAvatarFile } from "../lib/avatar";
import { UserAvatar } from "./user-avatar";

interface AvatarUploaderProps {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

const MAX_MB = Math.round(AVATAR_MAX_BYTES / (1024 * 1024));

/**
 * Uploads and removes the profile photo.
 *
 * The file input is hidden and driven by a real `<Button>` rather than styled
 * directly: a file input cannot be restyled without losing its own focus ring, and
 * a button is the control a keyboard user expects to find.
 *
 * The client-side `validateAvatarFile` call is a courtesy — it tells the user
 * "too large" without a round-trip. The action re-validates, and the bucket's
 * `file_size_limit` / `allowed_mime_types` reject anything that gets past both.
 */
export function AvatarUploader({ fullName, email, avatarUrl }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // The server sends a new `avatarUrl` once the write lands. Dropping the local
  // object URL at that point hands rendering back to the real image and releases
  // the blob; keeping both would leak one URL per upload.
  useEffect(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);

      return null;
    });
  }, [avatarUrl]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Always clear the input: picking the same file twice in a row has to fire
    // `change` again, and it only does if the value was reset.
    event.target.value = "";

    if (!file) return;

    const invalid = validateAvatarFile(file);

    if (invalid) {
      toast.error(invalid);

      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);

      return objectUrl;
    });

    const data = new FormData();
    data.set("avatar", file);

    setPending(true);

    try {
      const result = await uploadAvatarAction(data);

      if (isActionFailure(result)) {
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        toast.error(result.error);

        return;
      }

      toast.success(result.message ?? "Photo updated.");
    } catch {
      setPreview(null);
      URL.revokeObjectURL(objectUrl);
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    const result = await removeAvatarAction();

    if (isActionFailure(result)) {
      toast.error(result.error);

      return;
    }

    toast.success(result.message ?? "Photo removed.");
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative">
        <UserAvatar
          size="lg"
          fullName={fullName}
          email={email}
          avatarUrl={preview ?? avatarUrl}
          className="size-16"
        />
        {pending ? (
          <span
            role="status"
            aria-label="Uploading photo"
            className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
          >
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp data-icon="inline-start" />
            {avatarUrl ? "Replace photo" : "Upload photo"}
          </Button>

          {avatarUrl ? (
            <ConfirmDialog
              icon={Trash2}
              tone="destructive"
              title="Remove your photo?"
              description="Your initials will be shown instead. You can upload a new photo at any time."
              confirmLabel="Remove photo"
              onConfirm={handleRemove}
              trigger={
                <Button type="button" variant="ghost" disabled={pending}>
                  Remove
                </Button>
              }
            />
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or WebP. Up to {MAX_MB} MB. Square images look best.
        </p>
      </div>

      {/*
        Hidden rather than removed: it is still the element that opens the file
        picker. `aria-hidden` plus `tabIndex={-1}` keeps assistive tech and the tab
        order pointed at the button above, which carries the accessible name.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleChange}
      />
    </div>
  );
}
