"use client";

/**
 * One section, collapsed to a row or expanded to its fields.
 *
 * The header row is four siblings rather than one nested control: drag handle,
 * disclosure trigger, visibility toggle, overflow menu. A `<button>` cannot contain
 * a `<button>`, so anything that looks like it lives "inside" the row header has to
 * sit beside the trigger — the same constraint the resume cards on the dashboard
 * ran into.
 */

import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, IconButton } from "@/components/shared";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RESUME_LIMITS, SECTION_KIND_LABELS, type ResumeSection } from "@/types/resume";

import { RESUME_TITLE_MAX } from "../../schema/resume-schema";
import { useResumeStore } from "../../store/resume-store";
import { TextField } from "./editor-fields";
import { RichTextField } from "./rich-text-field";
import { ITEM_EMPTY_HINTS, ITEM_NOUNS, ItemFields, summarizeItem } from "./item-fields";
import { RepeatableSection } from "./repeatable-section";
import { SortableHandle, SortableRow } from "./sortable-list";

interface SectionPanelProps {
  section: ResumeSection;
}

export function SectionPanel({ section }: SectionPanelProps) {
  const renameSection = useResumeStore((state) => state.renameSection);
  const setSectionVisibility = useResumeStore((state) => state.setSectionVisibility);
  const removeSection = useResumeStore((state) => state.removeSection);
  const setSummary = useResumeStore((state) => state.setSummary);

  // Local `open` rather than `ConfirmDialog`'s own trigger: the trigger would live
  // inside a menu item, and activating that item unmounts the menu before the
  // dialog can open.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const heading = section.title.trim() || SECTION_KIND_LABELS[section.kind];
  const itemCount = section.kind === "summary" ? null : section.items.length;
  const itemNoun = section.kind === "summary" ? null : ITEM_NOUNS[section.kind];
  const deleteDescription =
    itemCount && itemNoun
      ? `This removes the section and its ${itemCount} ${itemNoun}${itemCount === 1 ? "" : "s"}. Undo with ⌘Z.`
      : "This removes the section. Undo with ⌘Z.";

  return (
    <SortableRow id={section.id}>
      {({ handleProps, isDragging }) => (
        <AccordionItem
          value={section.id}
          className={cn(
            "rounded-xl border border-border/70 bg-card/40 not-last:border-b",
            isDragging && "shadow-lg ring-1 ring-ring/30",
            !section.visible && "opacity-70",
          )}
        >
          <div className="flex items-center gap-1 px-1.5 py-1">
            <SortableHandle label={heading} {...handleProps} />

            <AccordionTrigger className="min-w-0 flex-1 items-center px-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{heading}</span>
                {itemCount !== null ? (
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {itemCount}
                  </Badge>
                ) : null}
                {!section.visible ? (
                  <Badge variant="outline" className="shrink-0">
                    Hidden
                  </Badge>
                ) : null}
              </span>
            </AccordionTrigger>

            <IconButton
              label={section.visible ? `Hide ${heading} from the resume` : `Show ${heading}`}
              icon={
                section.visible ? (
                  <Eye aria-hidden className="size-3.5" />
                ) : (
                  <EyeOff aria-hidden className="size-3.5" />
                )
              }
              size="icon-sm"
              onClick={() => setSectionVisibility(section.id, !section.visible)}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={`More options for ${heading}`}>
                    <MoreHorizontal aria-hidden className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 aria-hidden className="size-4" />
                  Delete section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AccordionContent className="px-3 pb-3">
            <div className="space-y-4 border-t border-border/60 pt-3">
              <TextField
                label="Section heading"
                value={section.title}
                maxLength={RESUME_TITLE_MAX}
                hint={`Printed on the resume. The kind is ${SECTION_KIND_LABELS[section.kind].toLowerCase()}.`}
                onChange={(title) => renameSection(section.id, title)}
              />

              {section.kind === "summary" ? (
                <RichTextField
                  label="Summary"
                  value={section.content}
                  maxLength={RESUME_LIMITS.sectionRichText}
                  placeholder="Three or four lines: what you do, how long you have done it, and the thing you are best at. Written for the specific job where possible."
                  onChange={(content) => setSummary(section.id, content)}
                />
              ) : (
                <RepeatableSection
                  sectionId={section.id}
                  kind={section.kind}
                  items={section.items}
                  itemNoun={ITEM_NOUNS[section.kind]}
                  emptyHint={ITEM_EMPTY_HINTS[section.kind]}
                  summarize={(item) => summarizeItem(section, item)}
                  renderFields={(item) => <ItemFields section={section} item={item} />}
                />
              )}
            </div>
          </AccordionContent>

          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={`Delete ${heading}?`}
            description={deleteDescription}
            confirmLabel="Delete section"
            tone="destructive"
            onConfirm={() => {
              removeSection(section.id);
              toast.success(`${heading} deleted.`, { description: "Undo with ⌘Z." });
            }}
          />
        </AccordionItem>
      )}
    </SortableRow>
  );
}
