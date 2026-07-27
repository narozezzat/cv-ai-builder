"use client";

/**
 * The two array editors: bullet points and keyword chips.
 *
 * Both own their array wholesale and hand the whole next value back — the store
 * patches `{ highlights: next }` rather than exposing add/remove/move actions per
 * array. Eleven item kinds carry these fields between them, so a per-array action
 * set would be thirty-odd near-identical store methods.
 *
 * They differ because the content differs. A bullet is a sentence that needs room
 * and ordering (recruiters read the first two); a keyword is a word whose order
 * carries no meaning and whose list is long. Same data shape, two right answers.
 */

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";

import { IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { moveArrayItem } from "@/utils/array";

interface BulletListFieldProps {
  label: string;
  /** Bullets in display order. */
  value: string[];
  onChange: (next: string[]) => void;
  maxItems: number;
  maxLength: number;
  placeholder?: string;
  className?: string;
}

/**
 * Bullet points, reordered with buttons rather than dragging.
 *
 * The buttons are the deliberate choice: these rows are textareas, and a drag
 * handle beside a text cursor is a mis-click that scrambles the list. Up/down also
 * works identically for pointer, keyboard, and screen-reader users, where a drag
 * needs three separate implementations to reach parity.
 */
export function BulletListField({
  label,
  value,
  onChange,
  maxItems,
  maxLength,
  placeholder,
  className,
}: BulletListFieldProps) {
  const groupId = useId();
  const atCap = value.length >= maxItems;

  function update(index: number, text: string): void {
    onChange(value.map((bullet, position) => (position === index ? text : bullet)));
  }

  function remove(index: number): void {
    onChange(value.filter((_, position) => position !== index));
  }

  function move(from: number, to: number): void {
    if (to < 0 || to >= value.length) return;

    onChange(moveArrayItem(value, from, to));
  }

  return (
    <div className={cn("space-y-2", className)} role="group" aria-labelledby={groupId}>
      <div className="flex items-center justify-between gap-2">
        <Label id={groupId} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground" aria-hidden>
          {value.length} / {maxItems}
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No bullets yet. These are what a recruiter actually reads — one achievement each, with a
          number in it where you have one.
        </p>
      ) : null}

      <ul className="space-y-2">
        {value.map((bullet, index) => (
          // Index as key: bullets are plain strings with no id, and the array is
          // only ever rewritten as a whole, so a stable identity does not exist to
          // key on. Reordering therefore remounts a row — acceptable, because the
          // value is fully controlled and the caret is the only state lost.
          <li key={index} className="flex items-start gap-1.5">
            <Textarea
              value={bullet}
              rows={2}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              className="min-h-16 flex-1 resize-y"
              onChange={(event) => update(index, event.target.value)}
            />

            <div className="flex flex-col gap-0.5 pt-0.5">
              <IconButton
                label={`Move ${label} ${index + 1} up`}
                icon={<ArrowUp aria-hidden className="size-3.5" />}
                size="icon-xs"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              />
              <IconButton
                label={`Move ${label} ${index + 1} down`}
                icon={<ArrowDown aria-hidden className="size-3.5" />}
                size="icon-xs"
                disabled={index === value.length - 1}
                onClick={() => move(index, index + 1)}
              />
              <IconButton
                label={`Remove ${label} ${index + 1}`}
                icon={<Trash2 aria-hidden className="size-3.5" />}
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
              />
            </div>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={atCap}
        onClick={() => onChange([...value, ""])}
      >
        <Plus aria-hidden className="size-3.5" />
        Add bullet
      </Button>

      {atCap ? (
        <p className="text-xs text-muted-foreground">
          That is the maximum of {maxItems}. Trim the weakest one before adding another.
        </p>
      ) : null}
    </div>
  );
}

interface KeywordListFieldProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  maxItems: number;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  className?: string;
}

/**
 * Keyword chips: type, press Enter or comma, get a chip.
 *
 * Pasting a comma-separated list splits it, because that is how a job description's
 * requirements arrive. Duplicates are dropped case-insensitively — a resume listing
 * "React" and "react" reads as a mistake to a human and counts once to an ATS.
 */
export function KeywordListField({
  label,
  value,
  onChange,
  maxItems,
  maxLength,
  placeholder,
  hint,
  className,
}: KeywordListFieldProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const atCap = value.length >= maxItems;

  function commit(text: string): void {
    const additions = text
      .split(",")
      .map((entry) => entry.trim().slice(0, maxLength))
      .filter((entry) => entry.length > 0);

    if (additions.length === 0) {
      setDraft("");

      return;
    }

    const seen = new Set(value.map((entry) => entry.toLowerCase()));
    const next = [...value];

    for (const addition of additions) {
      if (next.length >= maxItems) break;
      if (seen.has(addition.toLowerCase())) continue;

      seen.add(addition.toLowerCase());
      next.push(addition);
    }

    setDraft("");

    if (next.length !== value.length) {
      onChange(next);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground" aria-hidden>
          {value.length} / {maxItems}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((keyword, index) => (
            <li key={`${keyword}-${index}`}>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-0.5 pr-1 pl-2.5 text-xs">
                {keyword}
                <button
                  type="button"
                  aria-label={`Remove ${keyword}`}
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={inputId}
        value={draft}
        placeholder={atCap ? `Maximum of ${maxItems} reached` : placeholder}
        maxLength={maxLength * 4}
        disabled={atCap}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        onChange={(event) => {
          // A trailing comma means the entry is finished, so committing on it makes
          // pasted lists behave the same as typed ones.
          if (event.target.value.endsWith(",")) {
            commit(event.target.value);

            return;
          }

          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Otherwise Enter inside the editor's field group submits nothing and
            // the browser scrolls — the chip never appears.
            event.preventDefault();
            commit(draft);

            return;
          }

          if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        // A chip half-typed and then abandoned is still what the user meant.
        onBlur={() => commit(draft)}
      />

      {hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
