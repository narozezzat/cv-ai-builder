"use client";

/**
 * The list of sections, reorderable, each one expandable.
 *
 * Which panels are open is local state, and it starts from the store's
 * `activeSectionId` rather than owning that value: the store sets it when a section
 * is added (and later, when the command palette jumps to one), and this reads it as
 * an initial value plus reacts to changes. Undo must not close a panel, which is why
 * the open set is not in the draft.
 */

import { useEffect, useState } from "react";

import { Accordion } from "@/components/ui/accordion";
import { RESUME_LIMITS } from "@/types/resume";

import { selectSections, useResumeStore } from "../../store/resume-store";
import { AddSectionMenu } from "./add-section-menu";
import { SectionPanel } from "./section-panel";
import { SortableList } from "./sortable-list";

export function SectionList() {
  const sections = useResumeStore(selectSections);
  const moveSection = useResumeStore((state) => state.moveSection);
  const activeSectionId = useResumeStore((state) => state.activeSectionId);

  const [openValues, setOpenValues] = useState<string[]>(() =>
    activeSectionId ? [activeSectionId] : [],
  );

  /**
   * Every panel closes for the duration of a drag, and reopens after it.
   *
   * Rows of wildly different heights make reordering unusable — with the keyboard it
   * does not work at all (see `onDraggingChange`), and with a pointer a 250px row
   * covers two of its neighbours so the drop target is a guess. Collapsing is also
   * simply the better view of the operation: while reordering, the thing being
   * reordered is the list, not the contents.
   */
  const [dragging, setDragging] = useState(false);

  // A section added from the menu (or, later, from the command palette) sets
  // `activeSectionId`; opening it here is what makes "add" feel like it did
  // something. Existing open panels stay open — collapsing the user's context to
  // show a new empty section would be the wrong trade.
  useEffect(() => {
    if (!activeSectionId) return;

    setOpenValues((current) =>
      current.includes(activeSectionId) ? current : [...current, activeSectionId],
    );
  }, [activeSectionId]);

  const ids = sections.map((section) => section.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Sections</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sections.length} / {RESUME_LIMITS.sections}
        </span>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          This resume has no sections. Add a summary and an experience section to start — those two
          carry most of the weight.
        </p>
      ) : (
        <SortableList
          ids={ids}
          onMove={moveSection}
          labelFor={(id) => sections.find((section) => section.id === id)?.title ?? ""}
          itemNoun="section"
          onDraggingChange={setDragging}
        >
          {/*
            `openMultiple` is the default and stays on: comparing two sections, or
            keeping experience open while adding a skill, is the normal way this
            gets used. `value`/`onValueChange` are controlled so the store can open
            a panel from outside the tree.
          */}
          <Accordion
            value={dragging ? [] : openValues}
            // Ignored while dragging: the empty `value` above would otherwise be
            // read back as "the user closed everything" and the panels would not
            // reopen on drop.
            onValueChange={(next) => {
              if (!dragging) setOpenValues(next.map(String));
            }}
            className="gap-2"
          >
            {sections.map((section) => (
              <SectionPanel key={section.id} section={section} />
            ))}
          </Accordion>
        </SortableList>
      )}

      <AddSectionMenu sectionCount={sections.length} />
    </div>
  );
}
