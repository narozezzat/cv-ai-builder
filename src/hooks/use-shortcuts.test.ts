import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatShortcut,
  matchesCombo,
  parseCombo,
  useShortcuts,
  type Shortcut,
} from "./use-shortcuts";

function press(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });

  window.dispatchEvent(event);

  return event;
}

/** Dispatched from an element so `event.target` is the field, as a real keypress is. */
function pressIn(tag: "input" | "textarea", init: KeyboardEventInit & { key: string }): void {
  const element = document.createElement(tag);
  document.body.append(element);
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  element.remove();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("parseCombo", () => {
  it("reads modifiers in any order and any spelling", () => {
    expect(parseCombo("Shift+Cmd+Z")).toEqual({
      key: "z",
      mod: false,
      meta: true,
      ctrl: false,
      alt: false,
      shift: true,
    });

    expect(parseCombo("cmd+shift+z")).toEqual(parseCombo("Shift+Cmd+Z"));
  });

  it("resolves key aliases", () => {
    expect(parseCombo("esc").key).toBe("escape");
    expect(parseCombo("mod+space").key).toBe(" ");
    expect(parseCombo("alt+up").key).toBe("arrowup");
  });

  it("survives a combo whose key is `+`", () => {
    expect(parseCombo("mod++")).toMatchObject({ key: "+", mod: true });
  });
});

describe("matchesCombo", () => {
  it("treats `mod` as satisfied by either ⌘ or Ctrl", () => {
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "k", metaKey: true }), "mod+k")).toBe(
      true,
    );
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }), "mod+k")).toBe(
      true,
    );
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "k" }), "mod+k")).toBe(false);
  });

  it("is case-insensitive about the key the browser reports", () => {
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "K", metaKey: true }), "mod+k")).toBe(
      true,
    );
  });

  /**
   * The regression this whole module exists for: a naive `key === "z" && metaKey`
   * check fires undo on redo's keypress, so both run and the redo never lands.
   */
  it("does not match a combo when an unnamed modifier is held", () => {
    const redoPress = new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true });

    expect(matchesCombo(redoPress, "mod+z")).toBe(false);
    expect(matchesCombo(redoPress, "shift+mod+z")).toBe(true);
  });

  it("requires an explicit ctrl combo to be ctrl, not meta", () => {
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "k", metaKey: true }), "ctrl+k")).toBe(
      false,
    );
  });

  it("ignores shift for punctuation the shift key produces", () => {
    // `Shift+/` arrives as `?`. Requiring the combo to spell the shift out would mean
    // a `?` shortcut could never match any real keypress.
    expect(matchesCombo(new KeyboardEvent("keydown", { key: "?", shiftKey: true }), "?")).toBe(
      true,
    );
  });
});

describe("useShortcuts", () => {
  it("runs the handler and prevents the default", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "mod+s", handler }]));

    const event = press({ key: "s", metaKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the default alone when asked to", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "mod+s", handler, preventDefault: false }]));

    expect(press({ key: "s", metaKey: true }).defaultPrevented).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops at the first match", () => {
    const first = vi.fn();
    const second = vi.fn();
    renderHook(() =>
      useShortcuts([
        { combo: "mod+k", handler: first },
        { combo: "mod+k", handler: second },
      ]),
    );

    press({ key: "k", metaKey: true });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("skips a disabled shortcut and falls through to the next match", () => {
    const disabled = vi.fn();
    const enabled = vi.fn();
    renderHook(() =>
      useShortcuts([
        { combo: "mod+k", handler: disabled, enabled: false },
        { combo: "mod+k", handler: enabled },
      ]),
    );

    press({ key: "k", metaKey: true });

    expect(disabled).not.toHaveBeenCalled();
    expect(enabled).toHaveBeenCalledTimes(1);
  });

  it("fires a mod combo while focus is in a text field", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "mod+s", handler }]));

    pressIn("input", { key: "s", metaKey: true });

    // Cmd+S must save while the caret is in the summary field — that is when it matters.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire a bare key while focus is in a text field", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "/", handler }]));

    pressIn("input", { key: "/" });
    expect(handler).not.toHaveBeenCalled();

    press({ key: "/" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("honours an explicit `allowInInput: false` on a mod combo", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "mod+z", handler, allowInInput: false }]));

    // Undo inside a field belongs to the field's own stack, not to document history.
    pressIn("textarea", { key: "z", metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores an event something closer already handled", () => {
    const handler = vi.fn();
    renderHook(() => useShortcuts([{ combo: "escape", handler }]));

    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it("sees handlers from the latest render without resubscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");

    const { rerender } = renderHook(
      ({ handler }: { handler: Shortcut["handler"] }) =>
        useShortcuts([{ combo: "mod+k", handler }]),
      { initialProps: { handler: first } },
    );

    const subscriptions = addSpy.mock.calls.filter(([type]) => type === "keydown").length;

    rerender({ handler: second });
    press({ key: "k", metaKey: true });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(subscriptions);

    addSpy.mockRestore();
  });

  it("detaches when disabled and on unmount", () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useShortcuts([{ combo: "mod+k", handler }], { enabled }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    press({ key: "k", metaKey: true });
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });
    press({ key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    press({ key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("formatShortcut", () => {
  it("writes Apple modifiers as symbols in a fixed order", () => {
    expect(formatShortcut("mod+k", true)).toBe("⌘K");
    expect(formatShortcut("shift+mod+z", true)).toBe("⇧⌘Z");
    // Written in a different order, printed the same.
    expect(formatShortcut("mod+shift+z", true)).toBe("⇧⌘Z");
    expect(formatShortcut("alt+shift+mod+p", true)).toBe("⌥⇧⌘P");
  });

  it("writes PC modifiers as names joined with +", () => {
    expect(formatShortcut("mod+k", false)).toBe("Ctrl+K");
    expect(formatShortcut("shift+mod+z", false)).toBe("Ctrl+Shift+Z");
  });

  it("labels named keys printably", () => {
    expect(formatShortcut("escape", true)).toBe("Esc");
    expect(formatShortcut("mod+enter", true)).toBe("⌘↵");
    expect(formatShortcut("alt+up", false)).toBe("Alt+↑");
    expect(formatShortcut("mod+space", true)).toBe("⌘Space");
  });
});
