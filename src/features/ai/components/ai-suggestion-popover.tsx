"use client";

/**
 * The one review surface every AI capability funnels through.
 *
 * Fifteen capabilities, one popover. What it owns is not layout — it is the four
 * things that are easy to get subtly wrong per call site and impossible to get wrong
 * once: the suggestion never touches the document until accept (so a rejection leaves
 * no undo entry), accept is exactly one store write (so undo removes it in one step),
 * paging a cached variant never spends a credit, and every failure code gets the
 * action that can actually resolve it.
 *
 * Two shapes of suggestion, because there are only two. Prose replaces what is there
 * and is reviewed as a word diff. A list either replaces (line diff) or adds
 * (checkboxes) — and which one it is belongs to the capability, not the user:
 * `skills.suggest` proposes additions, and rendering those as a diff would imply that
 * accepting them deletes the rest.
 *
 * Text values in and out are **plain text**. The model is instructed never to emit
 * HTML, and a rich-text call site converts on accept with `plainTextToRichText` and
 * passes its own stripped prose in as `value`. Diffing HTML would compare tags.
 */

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useAiSuggestion, type AiSuggestionStatus } from "../hooks/use-ai-suggestion";
import type { AiActionResult } from "../lib/ai-action-result";
import { mergeListItems, type AiSuggestion } from "../lib/suggestion";
import { diffLines, diffWords, hasDiffChanges, type DiffSegment } from "../lib/text-diff";
import { AiFailureNotice } from "./ai-failure-notice";

/** The final value, ready to be written. Never a patch the caller has to apply. */
export type AiAcceptPayload = { kind: "text"; text: string } | { kind: "list"; items: string[] };

export interface AiSuggestionPopoverProps<TData, TSuggestion extends AiSuggestion> {
  /** Trigger text. Short and verb-first — "Write with AI", "Improve bullets". */
  label: string;
  title: string;
  description?: string;
  /** What is in the field now: the left side of the diff and the merge base. */
  value: AiAcceptPayload;
  run: () => Promise<AiActionResult<TData>>;
  toSuggestions: (data: TData) => TSuggestion[];
  /**
   * The field's own caps, applied to a list before it is written.
   *
   * Omitted leaves the merge uncapped, which is right when the field has no cap —
   * inventing one here would silently drop items the user chose.
   */
  limits?: { maxItems: number; maxLength: number };
  /** For prerequisites the user can fix, e.g. a role with no job title yet. */
  disabled?: boolean;
  disabledReason?: string;
  onAccept: (payload: AiAcceptPayload) => void;
  align?: "start" | "center" | "end";
}

const UNCAPPED = { maxItems: Number.MAX_SAFE_INTEGER, maxLength: Number.MAX_SAFE_INTEGER };

export function AiSuggestionPopover<TData, TSuggestion extends AiSuggestion>({
  label,
  title,
  description,
  value,
  run,
  toSuggestions,
  limits,
  disabled = false,
  disabledReason,
  onAccept,
  align = "end",
}: AiSuggestionPopoverProps<TData, TSuggestion>) {
  const [open, setOpen] = useState(false);
  const suggestion = useAiSuggestion({ run, toSuggestions });

  /**
   * Which items of an additive suggestion are ticked.
   *
   * Keyed by suggestion id and derived rather than synced in an effect: when a
   * regenerate lands, the id changes and the default — everything not already in the
   * field — takes over on the same render as the new items.
   */
  const [selection, setSelection] = useState<{ id: string; items: string[] } | null>(null);

  const active = suggestion.current;
  const additions =
    active?.kind === "list" && active.mode === "append" ? withoutExisting(active.items, value) : [];
  const selected = active && selection?.id === active.id ? selection.items : additions;

  function handleOpenChange(next: boolean): void {
    setOpen(next);

    if (next) {
      // Opening is the request. An extra "Generate" click inside a popover the user
      // opened to generate something is a step that only ever gets clicked.
      if (suggestion.status === "idle") suggestion.request();

      return;
    }

    // Closing is the rejection, however it happened — Escape, outside click, Discard.
    suggestion.reset();
    setSelection(null);
  }

  function accept(): void {
    if (!active) return;

    if (active.kind === "text") {
      onAccept({ kind: "text", text: active.text });
    } else if (active.mode === "replace") {
      // Through the same merge as an append so the field's caps and the
      // case-insensitive dedupe apply to a replacement too.
      onAccept({ kind: "list", items: mergeListItems([], active.items, limits ?? UNCAPPED) });
    } else {
      onAccept({
        kind: "list",
        items: mergeListItems(currentItems(value), selected, limits ?? UNCAPPED),
      });
    }

    handleOpenChange(false);
  }

  const acceptable = isAcceptable(active, value, selected);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="text-muted-foreground hover:text-brand"
          >
            <Sparkles aria-hidden className="size-3.5" />
            {label}
            {disabled && disabledReason ? (
              <span className="sr-only">— unavailable: {disabledReason}</span>
            ) : null}
          </Button>
        }
      />

      <PopoverContent align={align} className="w-88 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          {description ? <PopoverDescription>{description}</PopoverDescription> : null}
        </PopoverHeader>

        {/* One region for every transition, so a screen reader hears "generating",
            then the outcome, without the popover stealing focus mid-request. */}
        <p aria-live="polite" className="sr-only">
          {announcement(suggestion.status, suggestion.failure?.error)}
        </p>

        {suggestion.status === "loading" ? <LoadingBody /> : null}

        {suggestion.status === "error" && suggestion.failure ? (
          <AiFailureNotice failure={suggestion.failure} onRetry={suggestion.request} />
        ) : null}

        {suggestion.status === "empty" ? (
          <p className="text-xs text-muted-foreground">
            The model returned nothing usable this time. Regenerating usually fixes it.
          </p>
        ) : null}

        {active ? (
          <div className="space-y-2">
            {active.kind === "text" ? (
              <TextDiffBody before={textOf(value)} after={active.text} />
            ) : active.mode === "replace" ? (
              <LineDiffBody before={currentItems(value)} after={active.items} />
            ) : (
              <AdditionsBody
                items={additions}
                selected={selected}
                onToggle={(item, checked) =>
                  setSelection({
                    id: active.id,
                    items: checked ? [...selected, item] : selected.filter((it) => it !== item),
                  })
                }
              />
            )}

            {active.notes && active.notes.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {active.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          <span>
            {suggestion.suggestions.length > 1 ? (
              <>
                Option {suggestion.index + 1} of {suggestion.suggestions.length}
                {active?.label ? ` — ${active.label}` : null}
              </>
            ) : suggestion.creditsRemaining !== null ? (
              `${suggestion.creditsRemaining} credits left`
            ) : null}
          </span>

          <span className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={() => handleOpenChange(false)}>
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={suggestion.status === "loading"}
              onClick={suggestion.next}
            >
              {suggestion.nextCostsCredit ? "Regenerate" : "Next option"}
            </Button>
            <Button type="button" size="xs" disabled={!acceptable} onClick={accept}>
              Accept
            </Button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LoadingBody() {
  return (
    <div className="space-y-1.5" aria-hidden>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

function TextDiffBody({ before, after }: { before: string; after: string }) {
  const segments = diffWords(before, after);

  if (!hasDiffChanges(segments)) {
    return (
      <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        The suggestion matches what you already have.
      </p>
    );
  }

  return (
    <p className="max-h-56 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs leading-relaxed">
      {segments.map((segment, index) => (
        <span key={index}>
          <span className={segmentClass(segment)}>
            <span className="sr-only">{srPrefix(segment)}</span>
            {segment.value}
          </span>
          {index < segments.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

function LineDiffBody({ before, after }: { before: readonly string[]; after: readonly string[] }) {
  const segments = diffLines(before, after);

  if (!hasDiffChanges(segments)) {
    return (
      <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        The suggestion matches what you already have.
      </p>
    );
  }

  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs">
      {segments.map((segment, index) => (
        <li key={index} className={cn("flex gap-1.5", segmentClass(segment))}>
          <span aria-hidden className="shrink-0 font-mono">
            {segment.op === "added" ? "+" : segment.op === "removed" ? "−" : "•"}
          </span>
          <span>
            <span className="sr-only">{srPrefix(segment)}</span>
            {segment.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface AdditionsBodyProps {
  items: string[];
  selected: string[];
  onToggle: (item: string, checked: boolean) => void;
}

function AdditionsBody({ items, selected, onToggle }: AdditionsBodyProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        Everything suggested is already on your resume.
      </p>
    );
  }

  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto">
      {items.map((item) => (
        <li key={item}>
          <label className="flex cursor-pointer items-start gap-2 rounded-md p-1 text-xs hover:bg-muted/50">
            <Checkbox
              className="mt-px"
              checked={selected.includes(item)}
              onCheckedChange={(checked) => onToggle(item, checked === true)}
            />
            <span>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function segmentClass(segment: DiffSegment): string {
  if (segment.op === "added") return "rounded bg-success/15 px-0.5 text-success";
  if (segment.op === "removed") return "text-muted-foreground line-through";

  return "";
}

/** Colour is the only signal for a diff op on screen; this is the other one. */
function srPrefix(segment: DiffSegment): string {
  if (segment.op === "added") return "Added: ";
  if (segment.op === "removed") return "Removed: ";

  return "";
}

function announcement(status: AiSuggestionStatus, error?: string): string {
  switch (status) {
    case "loading":
      return "Generating a suggestion.";
    case "ready":
      return "Suggestion ready for review.";
    case "empty":
      return "The model returned nothing usable.";
    case "error":
      return error ?? "That request failed.";
    default:
      return "";
  }
}

function textOf(value: AiAcceptPayload): string {
  return value.kind === "text" ? value.text : value.items.join("\n");
}

function currentItems(value: AiAcceptPayload): string[] {
  return value.kind === "list" ? value.items : [];
}

/** Ticking an item the field already has would accept a no-op. */
function withoutExisting(items: readonly string[], value: AiAcceptPayload): string[] {
  const existing = new Set(currentItems(value).map((item) => item.toLowerCase()));

  return items.filter((item) => !existing.has(item.trim().toLowerCase()));
}

function isAcceptable(
  active: AiSuggestion | null,
  value: AiAcceptPayload,
  selected: string[],
): boolean {
  if (!active) return false;

  if (active.kind === "text") {
    return active.text.trim().length > 0 && hasDiffChanges(diffWords(textOf(value), active.text));
  }

  if (active.mode === "append") return selected.length > 0;

  return hasDiffChanges(diffLines(currentItems(value), active.items));
}
