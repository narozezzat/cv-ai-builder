"use client";

/**
 * The design panel: template, colour, type, page.
 *
 * A dialog rather than a sheet or a third editor column. Every control in here changes
 * the whole page at once — a different template, a different palette, a wider margin —
 * so the thing worth looking at while you drag a slider is the page, not the field you
 * are dragging. A sheet would slide over the editor's sticky preview and hide exactly
 * that, so the panel brings its own scaled page instead.
 *
 * Everything writes through `setTheme` / `setPage` / `setTemplateId`, which means every
 * change here lands in the same history stack as a keystroke: `⌘Z` walks back out of a
 * template experiment. That is also why "Reset design" needs no confirmation.
 *
 * Nothing in here subscribes to the document. The header mounts this component on every
 * render of the editor, so a subscription to the resume body would re-render the panel on
 * every keystroke; the theme, page, and template selectors return stable references and
 * the document subscription lives in `DesignPreview`, which Base UI unmounts while the
 * dialog is closed.
 */

import { Check, Palette, RotateCcw, Sliders, SquareDashed, Type } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getTemplateDefinition,
  resolveTemplate,
  ResumeRenderer,
  ScaledPage,
  TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TemplateThumbnail,
  type TemplateCategory,
  type TemplateDefinition,
} from "@/features/templates";
import { cn } from "@/lib/utils";
import {
  HEX_COLOR_PATTERN,
  PAGE_FORMATS,
  PAGE_FORMAT_LABELS,
  RESUME_FONTS,
  RESUME_FONT_LABELS,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  type PageFormat,
} from "@/types/resume";

import {
  selectDocument,
  selectPage,
  selectTemplateId,
  selectTheme,
  useResumeStore,
} from "../../store/resume-store";
import { SelectField, SliderField, SwitchField } from "./editor-fields";

/**
 * The sentinel for "whatever the template chose", which the theme stores as `null`.
 *
 * A value is needed because Base UI reads `null` as "nothing selected" and would show the
 * placeholder instead of a chosen option — and an item with value `""` collides with the
 * same thing. Safe as a sentinel because `RESUME_FONTS` contains no `"default"`.
 */
const TEMPLATE_DEFAULT_FONT = "default";

const FONT_OPTIONS = [
  { value: TEMPLATE_DEFAULT_FONT, label: "Template default" },
  ...RESUME_FONTS.map((font) => ({ value: font, label: RESUME_FONT_LABELS[font] })),
];

/** Width the preview column settles at on a desktop viewport. */
const PREVIEW_WIDTH = 260;

const CATEGORY_ALL = "all";

/** Registry order, deduplicated — the order a job seeker is expected to browse. */
const CATEGORIES: TemplateCategory[] = TEMPLATES.reduce<TemplateCategory[]>(
  (accumulator, definition) =>
    accumulator.includes(definition.category) ? accumulator : [...accumulator, definition.category],
  [],
);

export interface DesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesignDialog({ open, onOpenChange }: DesignDialogProps) {
  const theme = useResumeStore(selectTheme);
  const page = useResumeStore(selectPage);
  const templateId = useResumeStore(selectTemplateId);
  const setTheme = useResumeStore((state) => state.setTheme);
  const setPage = useResumeStore((state) => state.setPage);
  const setTemplateId = useResumeStore((state) => state.setTemplateId);

  const definition = getTemplateDefinition(templateId);

  function handleTemplateChange(next: TemplateDefinition): void {
    setTemplateId(next.id);

    const paletteId = carriedPaletteId(next, theme.paletteId);

    if (paletteId !== null) {
      setTheme({ paletteId });
    }
  }

  function handleReset(): void {
    setTheme(RESUME_THEME_DEFAULTS);
    setPage(RESUME_PAGE_DEFAULTS);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `p-0` so each pane owns its padding and the dividers reach the popup's edges,
          which in turn means the footer's default negative margins have to be cancelled. */}
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/60 p-4 pr-12 text-left">
          <DialogTitle>Design</DialogTitle>
          <DialogDescription>
            Template, colours, typography, and page setup. Every change is undoable.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col">
            <Tabs defaultValue="template" className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList variant="line" className="w-full justify-start gap-1 border-b px-4 py-2">
                <TabsTrigger value="template">
                  <SquareDashed data-icon="inline-start" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="colour">
                  <Palette data-icon="inline-start" />
                  Colour
                </TabsTrigger>
                <TabsTrigger value="type">
                  <Type data-icon="inline-start" />
                  Type
                </TabsTrigger>
                <TabsTrigger value="page">
                  <Sliders data-icon="inline-start" />
                  Page
                </TabsTrigger>
              </TabsList>

              {/*
                One `ScrollArea` per panel rather than one around the tabs: Base UI only
                mounts the active panel, so a shared scroller would carry the previous
                tab's scroll offset into the next one.
              */}
              <TabsContent value="template" className="min-h-0 flex-1">
                <ScrollArea className="h-full max-h-104">
                  <TemplatePanel
                    definition={definition}
                    paletteId={theme.paletteId}
                    onChange={handleTemplateChange}
                  />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="colour" className="min-h-0 flex-1">
                <ScrollArea className="h-full max-h-104">
                  <ColourPanel
                    definition={definition}
                    paletteId={theme.paletteId}
                    accent={theme.accent}
                    resolvedAccent={resolveTemplate({ templateId, theme, page }).colors.accent}
                    onPaletteChange={(id) => setTheme({ paletteId: id })}
                    onAccentChange={(next) => setTheme({ accent: next })}
                  />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="type" className="min-h-0 flex-1">
                <ScrollArea className="h-full max-h-104">
                  <div className="space-y-5 p-4">
                    <SelectField
                      label="Heading font"
                      value={theme.headingFont ?? TEMPLATE_DEFAULT_FONT}
                      options={FONT_OPTIONS}
                      placeholder="Template default"
                      onChange={(next) =>
                        setTheme({
                          headingFont: next === TEMPLATE_DEFAULT_FONT ? null : toFont(next),
                        })
                      }
                    />

                    <SelectField
                      label="Body font"
                      value={theme.bodyFont ?? TEMPLATE_DEFAULT_FONT}
                      options={FONT_OPTIONS}
                      placeholder="Template default"
                      onChange={(next) =>
                        setTheme({
                          bodyFont: next === TEMPLATE_DEFAULT_FONT ? null : toFont(next),
                        })
                      }
                    />

                    {/* `pt` is in the label, not the format options: it is not an `Intl`
                        unit, and a made-up one throws rather than degrading. */}
                    <SliderField
                      label="Body size (pt)"
                      value={theme.fontSize}
                      min={8}
                      max={13}
                      step={0.5}
                      formatOptions={{ minimumFractionDigits: 1 }}
                      hint="Most recruiters read 10 to 11 point comfortably."
                      onChange={(next) => setTheme({ fontSize: next })}
                    />

                    <SliderField
                      label="Line height"
                      value={theme.lineHeight}
                      min={1}
                      max={2}
                      step={0.05}
                      formatOptions={{ minimumFractionDigits: 2 }}
                      onChange={(next) => setTheme({ lineHeight: next })}
                    />

                    <SliderField
                      label="Section spacing"
                      value={theme.sectionSpacing}
                      min={0.5}
                      max={2}
                      step={0.05}
                      formatOptions={{ style: "percent" }}
                      hint="Scales the gap between sections, relative to the template's own."
                      onChange={(next) => setTheme({ sectionSpacing: next })}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="page" className="min-h-0 flex-1">
                <ScrollArea className="h-full max-h-104">
                  <div className="space-y-5 p-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Paper size
                      </Label>
                      <ToggleGroup
                        variant="outline"
                        spacing={0}
                        aria-label="Paper size"
                        className="w-fit"
                        value={[page.format]}
                        onValueChange={(groupValue) => {
                          const next = groupValue[0];

                          // Base UI clears the array when the active item is re-pressed.
                          // A resume always prints on something, so that is a no-op.
                          if (isPageFormat(next)) setPage({ format: next });
                        }}
                      >
                        {PAGE_FORMATS.map((format) => (
                          <ToggleGroupItem key={format} value={format}>
                            {PAGE_FORMAT_LABELS[format]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>

                    <SliderField
                      label="Margin"
                      value={page.margin}
                      min={8}
                      max={30}
                      step={1}
                      formatOptions={{ style: "unit", unit: "millimeter" }}
                      hint="Below 8mm most consumer printers clip the edge."
                      onChange={(next) => setPage({ margin: next })}
                    />

                    <SliderField
                      label="Zoom"
                      value={page.scale}
                      min={0.7}
                      max={1.3}
                      step={0.01}
                      formatOptions={{ style: "percent" }}
                      hint="Scales type and spacing together — the fastest way to win or lose a page."
                      onChange={(next) => setPage({ scale: next })}
                    />

                    <SwitchField
                      label="Show page numbers"
                      checked={page.showPageNumbers}
                      hint="Only appears once the resume runs past one page."
                      onChange={(next) => setPage({ showPageNumbers: next })}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Hidden below `sm`: at phone width the page would scale to a thumbnail too
              small to judge, and the editor's own preview is a scroll away. */}
          <div className="hidden w-64 shrink-0 border-l border-border/60 bg-muted/30 p-3 sm:block">
            <DesignPreview />
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-border/60">
          {/*
            No confirmation. Reset writes through the same history as everything else, so
            `⌘Z` puts a hand-tuned design back — a dialog here would guard nothing.
          */}
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw aria-hidden className="size-3.5" />
            Reset design
          </Button>

          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The palette a resume should hold after switching to `next`, or `null` to keep the one it
 * has.
 *
 * Palettes are per-template, so the id a resume carries is usually absent from the template
 * it just moved to. `resolveTemplate` falls back to the first palette either way, which is
 * why this is easy to get wrong unnoticed: the page looks right while the panel shows no
 * swatch selected, and the next palette click "does nothing" because it writes the id the
 * document already had. Writing the fallback down keeps the document and the UI agreeing.
 *
 * Exported for its test — the mismatch it guards against is invisible in the rendered page.
 */
export function carriedPaletteId(next: TemplateDefinition, paletteId: string): string | null {
  if (next.palettes.some((palette) => palette.id === paletteId)) return null;

  return next.palettes[0].id;
}

/** Narrows a `SelectField`'s string back to the closed font set the theme stores. */
function toFont(value: string): (typeof RESUME_FONTS)[number] | null {
  return RESUME_FONTS.find((font) => font === value) ?? null;
}

function isPageFormat(value: unknown): value is PageFormat {
  return typeof value === "string" && PAGE_FORMATS.some((format) => format === value);
}

function TemplatePanel({
  definition,
  paletteId,
  onChange,
}: {
  definition: TemplateDefinition;
  paletteId: string;
  onChange: (definition: TemplateDefinition) => void;
}) {
  /*
    Defaults to the current template's category rather than "all". Each card is a real
    rendered resume page, so twenty of them is twenty documents laid out in the browser
    while the user is mid-edit; starting narrow keeps that to a handful, and "All
    templates" is one click away for anyone actually browsing.
  */
  const [category, setCategory] = useState<TemplateCategory | typeof CATEGORY_ALL>(
    definition.category,
  );

  const visible = TEMPLATES.filter(
    (candidate) => category === CATEGORY_ALL || candidate.category === category,
  );

  return (
    <div className="space-y-3 p-4">
      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label="Template category"
        className="w-fit max-w-full flex-wrap"
        value={[category]}
        onValueChange={(groupValue) => {
          const next = groupValue[0];

          if (typeof next === "string") {
            setCategory(next as TemplateCategory | typeof CATEGORY_ALL);
          }
        }}
      >
        <ToggleGroupItem value={CATEGORY_ALL}>All</ToggleGroupItem>
        {CATEGORIES.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {TEMPLATE_CATEGORY_LABELS[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid grid-cols-2 gap-3">
        {visible.map((candidate) => {
          const selected = candidate.id === definition.id;

          return (
            <button
              key={candidate.id}
              type="button"
              // `aria-pressed`, not a radio: these are twenty buttons that each apply a
              // change immediately, and nothing here is submitted later.
              aria-pressed={selected}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-card text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                selected
                  ? "border-brand ring-1 ring-brand/40"
                  : "border-border/60 hover:border-brand/40",
              )}
              onClick={() => onChange(candidate)}
            >
              <TemplateThumbnail
                templateId={candidate.id}
                // The selected card previews the palette in use; the rest show their own
                // first, which is how they are designed to be read.
                paletteId={selected ? paletteId : undefined}
              />

              <span className="flex items-center justify-between gap-1 border-t border-border/40 px-2.5 py-2 text-xs font-medium">
                {candidate.name}
                {selected ? <Check aria-hidden className="size-3.5 text-brand" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColourPanel({
  definition,
  paletteId,
  accent,
  resolvedAccent,
  onPaletteChange,
  onAccentChange,
}: {
  definition: TemplateDefinition;
  paletteId: string;
  accent: string | null;
  /** What the page is actually using — the override if valid, otherwise the palette's. */
  resolvedAccent: string;
  onPaletteChange: (paletteId: string) => void;
  onAccentChange: (accent: string | null) => void;
}) {
  /*
    The text field keeps its own draft. A hex colour is invalid for five of the seven
    characters it takes to type, and writing each of those to the store would put five
    rejected values into the undo stack and flash the page back to the palette default in
    between. Only a complete `#rrggbb` is committed.
  */
  const [draft, setDraft] = useState<string | null>(accent);

  /*
    `null` means "no override typed", which is not the same as an empty field: the input
    then shows whatever the page resolved to, so switching palette moves the readout with
    it instead of stranding the previous palette's hex in a field nothing is using.
  */
  const [lastAccent, setLastAccent] = useState(accent);

  // Adjusting state during render rather than in an effect, per the React docs' "you don't
  // need an effect to reset state on a prop change". The accent can change from outside
  // this panel — an undo, or a palette switch two fields up — and a draft left over from
  // before would then contradict the page.
  if (accent !== lastAccent) {
    setLastAccent(accent);
    setDraft(accent);
  }

  const shown = draft ?? resolvedAccent;
  const malformed = draft !== null && !HEX_COLOR_PATTERN.test(draft);

  function handleDraft(next: string): void {
    setDraft(next);

    if (HEX_COLOR_PATTERN.test(next)) {
      onAccentChange(next);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          {definition.name} palettes
        </span>

        <div className="flex flex-wrap gap-2">
          {definition.palettes.map((palette) => {
            const selected = palette.id === paletteId;

            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={selected}
                // The swatch is the label, so the name has to be said out loud somewhere.
                aria-label={palette.name}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                  selected ? "border-brand bg-brand/5" : "border-border/60 hover:border-brand/40",
                )}
                onClick={() => onPaletteChange(palette.id)}
              >
                <span
                  aria-hidden
                  className="size-5 rounded-full ring-1 ring-border/60 ring-inset"
                  style={{ backgroundColor: palette.accent }}
                />
                {palette.name}
                {selected ? <Check aria-hidden className="size-3" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="design-accent" className="text-xs font-medium text-muted-foreground">
          Accent colour
        </Label>

        <div className="flex items-center gap-2">
          {/*
            A native colour input beside the text field. It cannot express "use the
            template's" — it always has a value — so the reset button below is the only way
            back to `null`, and the field shows the resolved colour until then.
          */}
          <input
            type="color"
            aria-label="Pick an accent colour"
            value={HEX_COLOR_PATTERN.test(shown) ? shown : resolvedAccent}
            className="size-9 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent p-0.5"
            onChange={(event) => handleDraft(event.target.value)}
          />

          <Input
            id="design-accent"
            value={shown}
            maxLength={7}
            spellCheck={false}
            placeholder="#2563eb"
            aria-invalid={malformed}
            aria-describedby={malformed ? "design-accent-error" : "design-accent-hint"}
            className="font-mono"
            onChange={(event) => handleDraft(event.target.value)}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={accent === null}
            onClick={() => {
              onAccentChange(null);
              setDraft(null);
            }}
          >
            Reset
          </Button>
        </div>

        {malformed ? (
          <p id="design-accent-error" className="text-xs font-medium text-destructive">
            Use a six-digit hex colour, like #2563eb.
          </p>
        ) : (
          <p id="design-accent-hint" className="text-xs text-muted-foreground">
            Overrides the palette&apos;s accent everywhere the template uses it.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The page, live.
 *
 * A separate component purely to keep the document subscription out of the panel above:
 * Base UI unmounts a closed dialog's content, so this — and the re-render per keystroke it
 * would otherwise cause — costs nothing while the panel is shut.
 *
 * `aria-hidden` for the same reason the gallery's thumbnails are: this is a picture of a
 * layout, and the real document is already on the page behind the dialog.
 */
function DesignPreview() {
  const resumeDocument = useResumeStore(selectDocument);
  const theme = useResumeStore(selectTheme);
  const page = useResumeStore(selectPage);
  const templateId = useResumeStore(selectTemplateId);

  const template = resolveTemplate({ templateId, theme, page });

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-border/60"
    >
      <ScaledPage
        width={template.page.widthPx}
        height={template.page.heightPx}
        initialWidth={PREVIEW_WIDTH}
      >
        <ResumeRenderer
          document={resumeDocument}
          theme={theme}
          page={page}
          templateId={templateId}
        />
      </ScaledPage>
    </div>
  );
}
