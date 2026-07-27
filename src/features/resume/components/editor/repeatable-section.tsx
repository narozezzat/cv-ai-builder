"use client";

/**
 * Every list-shaped section, once.
 *
 * Eleven of the twelve section kinds are "a list of items with the same fields",
 * and the only thing that varies between them is the field set. So add, duplicate,
 * remove, reorder, collapse, the empty state, and the item cap live here — written
 * once, keyboard-accessible once, announced once — and each kind supplies two
 * functions: how to summarise an item when collapsed, and what fields to show when
 * open.
 *
 * It takes `{ id: string }` rather than a generic item type, and that is deliberate
 * rather than lazy. `ItemSection["items"]` is a union of eleven array types, so a
 * generic would have nothing to infer from at the call site — the correlation between
 * a section's kind and its item type is already lost once the caller has narrowed to
 * "not summary". Type safety lives one level down instead: `ItemFields` narrows the
 * section union itself and hands each field set its concrete item, so a typo in a
 * field name is still a compile error where the fields are actually written. All this
 * component does with an item is read its id.
 */

import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { RESUME_LIMITS, type ItemSectionKind } from "@/types/resume";

import { useResumeStore } from "../../store/resume-store";
import { SortableHandle, SortableList, SortableRow } from "./sortable-list";

interface RepeatableItem {
  id: string;
}

interface RepeatableSectionProps {
  sectionId: string;
  kind: ItemSectionKind;
  items: readonly RepeatableItem[];
  /** Lower case, used in buttons and announcements: "job", "degree", "skill". */
  itemNoun: string;
  /** One line for the collapsed row. Falls back to a placeholder when empty. */
  summarize: (item: RepeatableItem) => { title: string; subtitle?: string };
  renderFields: (item: RepeatableItem) => ReactNode;
  /** Empty-state prompt. Explains what belongs here, not that it is empty. */
  emptyHint: string;
}

export function RepeatableSection({
  sectionId,
  kind,
  items,
  itemNoun,
  summarize,
  renderFields,
  emptyHint,
}: RepeatableSectionProps) {
  const addItem = useResumeStore((state) => state.addItem);
  const duplicateItem = useResumeStore((state) => state.duplicateItem);
  const removeItem = useResumeStore((state) => state.removeItem);
  const moveItem = useResumeStore((state) => state.moveItem);

  /**
   * Which items are expanded. Local, not in the store: the store's draft is what
   * autosave writes and undo rewinds, and neither should touch which card the user
   * has open. A `Set` rather than a single id because comparing two jobs side by
   * side is the normal way this editor gets used.
   */
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(items.slice(0, 1).map((item) => item.id)),
  );

  /** Cards collapse for the duration of a drag — same reason as the section list. */
  const [dragging, setDragging] = useState(false);

  function setOpen(itemId: string, open: boolean): void {
    setOpenIds((current) => {
      const next = new Set(current);

      if (open) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }

      return next;
    });
  }

  function handleAdd(): void {
    const itemId = addItem(kind, sectionId);

    if (!itemId) {
      toast.error(`This section holds ${RESUME_LIMITS.itemsPerSection} ${itemNoun}s at most.`);

      return;
    }

    // Opened on creation: a new card that appears collapsed and blank reads as
    // "nothing happened", and the first field is where the user is going anyway.
    setOpen(itemId, true);
  }

  function handleDuplicate(itemId: string): void {
    const copyId = duplicateItem(sectionId, itemId);

    if (!copyId) {
      toast.error(`This section holds ${RESUME_LIMITS.itemsPerSection} ${itemNoun}s at most.`);

      return;
    }

    setOpen(copyId, true);
    toast.success(`${itemNoun.charAt(0).toUpperCase()}${itemNoun.slice(1)} duplicated.`);
  }

  const ids = items.map((item) => item.id);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <SortableList
          ids={ids}
          onMove={(from, to) => moveItem(sectionId, from, to)}
          labelFor={(id) => {
            const item = items.find((candidate) => candidate.id === id);

            return item ? summarize(item).title : "";
          }}
          itemNoun={itemNoun}
          onDraggingChange={setDragging}
        >
          <ul className="space-y-2">
            {items.map((item, index) => {
              const { title, subtitle } = summarize(item);
              const heading = title.trim().length > 0 ? title : `Untitled ${itemNoun}`;
              const isOpen = openIds.has(item.id) && !dragging;

              return (
                <li key={item.id}>
                  <SortableRow id={item.id}>
                    {({ handleProps, isDragging }) => (
                      <Collapsible
                        open={isOpen}
                        // Ignored mid-drag, or the forced-closed state above would
                        // be read back as the user closing the card and it would
                        // not reopen on drop.
                        onOpenChange={(open) => {
                          if (!dragging) setOpen(item.id, open);
                        }}
                      >
                        <div
                          className={cn(
                            "rounded-xl border border-border/70 bg-card/60 transition-shadow",
                            isDragging && "shadow-lg ring-1 ring-ring/30",
                          )}
                        >
                          {/*
                            Handle, trigger, and the two icon buttons are siblings.
                            A button cannot contain a button, so anything
                            interactive that looks like it is "in" the row header
                            has to sit beside the disclosure trigger instead.
                          */}
                          <div className="flex items-center gap-1 px-1.5 py-1.5">
                            <SortableHandle label={heading} {...handleProps} />

                            <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                              <ChevronDown
                                aria-hidden
                                className={cn(
                                  "size-4 shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {heading}
                                </span>
                                {subtitle && subtitle.trim().length > 0 ? (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {subtitle}
                                  </span>
                                ) : null}
                              </span>
                              <span className="sr-only">
                                {itemNoun} {index + 1}
                              </span>
                            </CollapsibleTrigger>

                            <IconButton
                              label={`Duplicate ${heading}`}
                              icon={<Copy aria-hidden className="size-3.5" />}
                              size="icon-sm"
                              onClick={() => handleDuplicate(item.id)}
                            />
                            <IconButton
                              label={`Remove ${heading}`}
                              icon={<Trash2 aria-hidden className="size-3.5" />}
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                removeItem(sectionId, item.id);
                                // Undo is the safety net rather than a confirm
                                // dialog: one item is cheap to restore and a
                                // dialog on every removal makes cleaning up a
                                // ten-item list ten dialogs.
                                toast.success(`${heading} removed.`, {
                                  description: "Undo with ⌘Z.",
                                });
                              }}
                            />
                          </div>

                          <CollapsibleContent className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up">
                            <div className="space-y-3 border-t border-border/60 px-3 py-3">
                              {renderFields(item)}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}
                  </SortableRow>
                </li>
              );
            })}
          </ul>
        </SortableList>
      )}

      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus aria-hidden className="size-3.5" />
        Add {itemNoun}
      </Button>
    </div>
  );
}
