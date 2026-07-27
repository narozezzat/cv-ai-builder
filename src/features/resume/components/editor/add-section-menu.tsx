"use client";

/**
 * Adds a section.
 *
 * Every kind stays listed even once used: two experience sections is a legitimate
 * resume (employment and volunteering, or one per industry), and so is a second
 * custom block. Only the total cap removes options — and when it does, the menu says
 * why rather than silently doing nothing.
 */

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RESUME_LIMITS,
  RESUME_SECTION_KINDS,
  SECTION_KIND_DESCRIPTIONS,
  SECTION_KIND_LABELS,
} from "@/types/resume";

import { useResumeStore } from "../../store/resume-store";

export function AddSectionMenu({ sectionCount }: { sectionCount: number }) {
  const addSection = useResumeStore((state) => state.addSection);
  const atCap = sectionCount >= RESUME_LIMITS.sections;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={atCap}>
            <Plus aria-hidden className="size-3.5" />
            Add section
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="max-w-72">
        {RESUME_SECTION_KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            className="flex-col items-start gap-0.5"
            onClick={() => {
              if (!addSection(kind)) {
                toast.error(`A resume can hold ${RESUME_LIMITS.sections} sections.`);
              }
            }}
          >
            <span className="text-sm font-medium">{SECTION_KIND_LABELS[kind]}</span>
            <span className="text-xs text-muted-foreground">{SECTION_KIND_DESCRIPTIONS[kind]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
