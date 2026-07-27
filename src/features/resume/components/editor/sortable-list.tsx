"use client";

/**
 * Reordering, written once for every list in the editor.
 *
 * Sections and the items inside them are the same problem — a vertical list of
 * rows with a drag handle — so they share one implementation. `onMove` takes
 * indices rather than ids because that is what the store's `moveSection` and
 * `moveItem` take, and translating here means neither the caller nor the store has
 * to know about dnd-kit.
 *
 * Keyboard support is not an add-on. `KeyboardSensor` with the sortable
 * coordinate getter makes every list reorderable with Space then the arrow keys,
 * and the announcements below are what a screen reader user hears while doing it —
 * without them the operation is silent and therefore unusable. dnd-kit ships
 * defaults, but they say "item 2", and "Experience" is the only thing that helps.
 */

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SortableListProps {
  /** In current display order. Must be stable ids, never array indices. */
  ids: string[];
  /** Called with the indices to swap. A no-op move is filtered out first. */
  onMove: (from: number, to: number) => void;
  /**
   * Names an item for the screen-reader announcements, e.g. `"Experience"`.
   * Falls back to the position when the id is unknown, which only happens if a
   * row unmounts mid-drag.
   */
  labelFor: (id: string) => string;
  /** What the list contains, for the "picked up"/"dropped" wording. */
  itemNoun: string;
  /**
   * Called with `true` while a drag is in progress.
   *
   * Callers use it to collapse expanded rows, and that is not cosmetic. One arrow
   * press moves the dragged row by its neighbour's height, so a row expanded to
   * 250px never gets its centre past a 52px sibling — `closestCenter` keeps
   * resolving to the row itself and the keyboard reorder silently does nothing.
   * Uniform heights during the drag are what make it work at all.
   */
  onDraggingChange?: (dragging: boolean) => void;
  children: ReactNode;
}

export function SortableList({
  ids,
  onMove,
  labelFor,
  itemNoun,
  onDraggingChange,
  children,
}: SortableListProps) {
  const sensors = useSensors(
    // 6px keeps a click on the handle from starting a 1px drag that swallows the
    // click — the handle is small and the pointer moves while a button is pressed.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function name(id: string | number): string {
    const index = ids.indexOf(String(id));

    return labelFor(String(id)) || `${itemNoun} ${index + 1}`;
  }

  function position(id: string | number): number {
    return ids.indexOf(String(id)) + 1;
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${name(active.id)}. Use the arrow keys to move it, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${name(active.id)} is now position ${position(over.id)} of ${ids.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} dropped at position ${position(over.id)} of ${ids.length}.`
        : `${name(active.id)} returned to its original position.`,
    onDragCancel: ({ active }) => `Reordering cancelled. ${name(active.id)} was not moved.`,
  };

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;

    onDraggingChange?.(false);

    if (!over || active.id === over.id) {
      return;
    }

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));

    if (from === -1 || to === -1) {
      return;
    }

    onMove(from, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Vertical only. Deliberately *not* `restrictToParentElement`: it clamps the
      // drag to the measured parent rect and kills both pointer and keyboard
      // reordering — drags start, announce, and drop exactly where they began.
      modifiers={[restrictToVerticalAxis]}
      accessibility={{ announcements }}
      onDragStart={() => onDraggingChange?.(true)}
      onDragCancel={() => onDraggingChange?.(false)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export interface SortableRowRenderProps {
  /**
   * Spread onto the drag handle button. Carries the activator ref, the pointer
   * listeners, and the ARIA attributes dnd-kit needs on the control itself.
   */
  handleProps: ComponentProps<"button">;
  isDragging: boolean;
}

interface SortableRowProps {
  id: string;
  className?: string;
  children: (render: SortableRowRenderProps) => ReactNode;
}

/**
 * One draggable row.
 *
 * The handle is passed back to the caller rather than rendered here because the
 * row's header also holds a disclosure trigger and a menu, and their order in the
 * DOM is a layout decision. `SortableHandle` below is the default rendering of it.
 */
export function SortableRow({ id, className, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Lifted above its siblings while dragging, or the rows it passes over
      // paint on top of it.
      className={cn(isDragging && "relative z-10", className)}
    >
      {children({
        handleProps: { ...attributes, ...listeners, ref: setActivatorNodeRef },
        isDragging,
      })}
    </div>
  );
}

interface SortableHandleProps extends ComponentProps<"button"> {
  /** Completes the accessible name: "Reorder Experience". */
  label: string;
}

/**
 * The grip. A real `<button>` so it is tabbable and the keyboard sensor can
 * receive Space — a `div` with listeners would leave the list mouse-only.
 */
export function SortableHandle({ label, className, ...props }: SortableHandleProps) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${label}`}
      className={cn(
        "flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );
}
