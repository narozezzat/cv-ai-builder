import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TEMPLATES, getTemplateDefinition } from "@/features/templates";

import { carriedPaletteId } from "./design-dialog";
import { SliderField } from "./editor-fields";

/**
 * Two things in the design panel fail quietly rather than loudly.
 *
 * `SliderField` wraps a vendored slider whose thumb count comes from the shape of its
 * `value`, and whose only route to an accessible name is an `aria-labelledby` on the root
 * that the root forwards to a hidden range input. Both are invisible in a screenshot: a
 * second thumb looks like a design choice, and an unnamed slider announces as "slider".
 *
 * `carriedPaletteId` guards a mismatch the rendered page actively hides, since the resolver
 * falls back to the first palette whatever the document says.
 *
 * The role queries pass `{ hidden: true }` throughout. Base UI positions the thumb from a
 * measured track and keeps it `visibility: hidden` until that measurement lands, which in
 * jsdom never happens — so the thumb, and the range input inside it, sit outside the
 * accessibility tree here but not in a browser. The ARIA being asserted is on the input
 * either way; only its reachability is a jsdom artifact.
 *
 * That artifact also rules out `getByRole(…, { name })`: name computation returns the empty
 * string for a hidden node that nothing points `aria-labelledby` at, so the name is unknowable
 * here whether or not the wiring is right. What the naming tests assert instead is the wiring
 * itself — the ids on the input, and the text they resolve to.
 */

/** The text a screen reader would concatenate for the name, in `aria-labelledby` order. */
function labelledByText(element: HTMLElement): string[] {
  const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);

  return ids.map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? "");
}

function SliderHarness({ hint }: { hint?: string }) {
  const [value, setValue] = useState(14);

  return (
    <SliderField
      label="Margin"
      value={value}
      onChange={setValue}
      min={8}
      max={30}
      step={1}
      formatOptions={{ style: "unit", unit: "millimeter" }}
      hint={hint}
    />
  );
}

describe("SliderField", () => {
  it("renders one thumb for a scalar value", () => {
    render(<SliderHarness />);

    // The wrapper falls through to `[min, max]` for a bare number, so a scalar setting
    // arrives as a two-handled range. The call site passes `[value]` to stop that.
    expect(screen.getAllByRole("slider", { hidden: true })).toHaveLength(1);
  });

  it("names the slider from the visible label", () => {
    render(<SliderHarness />);

    // The label is a `<span>`, so `htmlFor` is not an option: this id list is the only thing
    // standing between the thumb and announcing itself as an unnamed "slider".
    expect(labelledByText(screen.getByRole("slider", { hidden: true }))).toEqual(["Margin"]);
  });

  it("appends the hint to the name, since the thumb takes no description", () => {
    render(<SliderHarness hint="Below 8mm most printers clip." />);

    expect(labelledByText(screen.getByRole("slider", { hidden: true }))).toEqual([
      "Margin",
      "Below 8mm most printers clip.",
    ]);
  });

  it("announces the same formatted value the readout shows", () => {
    render(<SliderHarness />);

    // One `formatOptions` object drives both, so a drift here means the readout and the
    // announcement were formatted from different sources.
    expect(screen.getByText("14 mm")).toBeInTheDocument();
    expect(screen.getByRole("slider", { hidden: true })).toHaveAttribute("aria-valuetext", "14 mm");
  });

  it("commits a keyboard step as a number", async () => {
    const user = userEvent.setup();

    render(<SliderHarness />);

    const slider = screen.getByRole("slider", { hidden: true });

    // Focused directly rather than tabbed to: `user.tab()` walks visible elements, and the
    // thumb is visibility-hidden here for want of a layout. Focus is what the arrow key
    // needs, and a real browser hands it over on Tab.
    slider.focus();
    expect(slider).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    // `15`, not `[15]`: the store's `setPage` takes a number, and the union in
    // `onValueChange` is the one place a stray array could reach it.
    expect(screen.getByText("15 mm")).toBeInTheDocument();
  });
});

describe("carriedPaletteId", () => {
  it("keeps a palette the new template also defines", () => {
    const definition = getTemplateDefinition("modern-slate");
    const shared = definition.palettes[2].id;

    expect(carriedPaletteId(definition, shared)).toBeNull();
  });

  it("falls back to the new template's first palette", () => {
    const definition = getTemplateDefinition("modern-slate");

    expect(carriedPaletteId(definition, "not-a-palette")).toBe(definition.palettes[0].id);
  });

  it("returns a palette every template actually defines", () => {
    // Guards a registry entry landing with an empty `palettes`, which would make the
    // fallback `undefined` and write a palette id nothing can resolve.
    for (const definition of TEMPLATES) {
      const carried = carriedPaletteId(definition, "not-a-palette");

      expect(definition.palettes.map((palette) => palette.id)).toContain(carried);
    }
  });
});
