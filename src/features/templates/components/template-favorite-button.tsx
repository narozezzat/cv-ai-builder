"use client";

/**
 * The star on a gallery card.
 *
 * `useOptimistic` rather than the `useState` mirror the resume card uses. The difference
 * matters here: `toggleTemplateFavoriteAction` revalidates the gallery, so the server
 * re-renders this card with a new `isFavorite` prop — and a `useState` copy seeded from a
 * prop would ignore it, leaving the star showing whatever the last click set. Optimistic
 * state is discarded when the transition settles, so the filled star during the round-trip
 * is a guess and the star afterwards is the database. A failed write needs no rollback for
 * the same reason: nothing revalidated, so the prop never moved, so the guess evaporates.
 */

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { cn } from "@/lib/utils";

import { toggleTemplateFavoriteAction } from "../actions/template-actions";

export interface TemplateFavoriteButtonProps {
  templateId: string;
  isFavorite: boolean;
  /** Template name, so the control says which template it stars. */
  templateName: string;
  className?: string;
}

export function TemplateFavoriteButton({
  templateId,
  isFavorite,
  templateName,
  className,
}: TemplateFavoriteButtonProps) {
  const [, startTransition] = useTransition();
  const [favorite, setFavorite] = useOptimistic(isFavorite);

  function toggle() {
    const next = !favorite;

    startTransition(async () => {
      setFavorite(next);

      const result = await toggleTemplateFavoriteAction({ templateId, isFavorite: next });

      if (isActionFailure(result)) {
        toast.error(result.error);
      }
    });
  }

  return (
    <IconButton
      size="icon-xs"
      variant="ghost"
      // The name is in the label because twenty cards otherwise give a screen reader
      // twenty controls called "Add to favourites" with nothing to tell them apart.
      label={
        favorite ? `Remove ${templateName} from favourites` : `Add ${templateName} to favourites`
      }
      aria-pressed={favorite}
      onClick={toggle}
      className={cn(
        "size-7 rounded-full border border-border/50 bg-background/80 shadow-xs backdrop-blur-md transition-all hover:scale-105 hover:bg-background active:scale-95",
        favorite && "border-brand/40 bg-brand/10 text-brand hover:bg-brand/20",
        className,
      )}
      icon={
        <Star
          className={cn(
            "size-3.5",
            favorite ? "fill-brand text-brand" : "text-muted-foreground hover:text-foreground",
          )}
        />
      }
    />
  );
}
