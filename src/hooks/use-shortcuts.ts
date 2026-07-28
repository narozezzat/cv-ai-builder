"use client";

/**
 * One keyboard-shortcut layer for the whole app.
 *
 * Every shortcut in the app goes through `useShortcuts` rather than a hand-rolled
 * `keydown` listener, because the three things that make shortcuts wrong are the
 * three things nobody remembers to write twice:
 *
 * 1. **Modifier matching is exact.** A listener that checks `event.key === "z" &&
 *    event.metaKey` also fires for `Cmd+Shift+Z`, so undo and redo trigger together
 *    and the redo never lands. Here a combo matches only when the modifiers it names
 *    are held and the ones it does not name are not.
 * 2. **Text fields are off limits by default for bare keys.** A `/` shortcut that
 *    also fires while someone types a URL into a field is a bug report. Combos that
 *    carry `mod`/`ctrl`/`meta` default the other way — `Cmd+S` must save while the
 *    caret is in the summary field, which is exactly when it matters.
 * 3. **Listeners must not resubscribe per render.** Handlers live in a ref, so a
 *    component may pass freshly-created closures on every render — as it will, since
 *    they close over state — without the window listener being torn down and rebuilt
 *    each time.
 *
 * `mod` is the portable modifier: ⌘ on Apple platforms, Ctrl everywhere else. It is
 * satisfied by either key on either platform, because a Mac with an external PC
 * keyboard is common and refusing `Ctrl+K` there buys nothing.
 */

import { useEffect, useRef, useState } from "react";

export interface Shortcut {
  /**
   * `+`-separated combo. Modifiers `mod` (⌘ or Ctrl), `meta`/`cmd`, `ctrl`,
   * `alt`/`option`, `shift`, then one key: a character (`k`, `/`, `?`) or a name
   * (`escape`, `enter`, `arrowup`, `space`). Case-insensitive.
   */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /**
   * Whether the shortcut fires while focus is in an input, textarea, select, or
   * contenteditable. Defaults to `true` for combos with `mod`/`meta`/`ctrl` and
   * `false` for everything else — a bare letter belongs to whatever is being typed
   * into, a modified one to the app.
   */
  allowInInput?: boolean;
  /** Defaults to `true`. Set `false` when the browser's own behaviour should stand. */
  preventDefault?: boolean;
  /** `false` leaves the shortcut registered but inert — cheaper than conditional hooks. */
  enabled?: boolean;
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

/** Spellings of the same modifier, so call sites can write whichever they think in. */
const MODIFIER_ALIASES: Record<string, keyof Omit<ParsedCombo, "key">> = {
  mod: "mod",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  win: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
};

/**
 * Keys whose `event.key` is not what a human writes in a combo. `" "` is the one
 * that bites: a combo containing a literal space cannot survive `split("+")`.
 */
const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  spacebar: " ",
  plus: "+",
  del: "delete",
  ins: "insert",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
};

/** Parsing is pure and combos are string literals, so each is parsed at most once. */
const parseCache = new Map<string, ParsedCombo>();

export function parseCombo(combo: string): ParsedCombo {
  const cached = parseCache.get(combo);

  if (cached) {
    return cached;
  }

  const parsed: ParsedCombo = {
    key: "",
    mod: false,
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
  };

  const tokens = combo.split("+").map((token) => token.trim().toLowerCase());
  let sawEmpty = false;

  for (const token of tokens) {
    if (token.length === 0) {
      sawEmpty = true;
      continue;
    }

    const modifier = MODIFIER_ALIASES[token];

    if (modifier) {
      parsed[modifier] = true;
      continue;
    }

    parsed.key = KEY_ALIASES[token] ?? token;
  }

  // `mod++` is mod plus the `+` key: splitting on the separator leaves the key itself
  // as an empty segment, and dropping it outright would leave the combo keyless — a
  // combo that then matches nothing, silently.
  if (!parsed.key && sawEmpty) {
    parsed.key = "+";
  }

  parseCache.set(combo, parsed);

  return parsed;
}

/**
 * Whether `event` is the combo.
 *
 * The one deliberate looseness is `shift` on punctuation. `Shift+/` produces
 * `event.key === "?"`, so a combo written as `?` describes a keypress that
 * necessarily holds shift; requiring the combo to spell it out would mean no `?`
 * shortcut ever matches. Letters and digits keep the strict check, because
 * `Shift+Z` and `Z` are different shortcuts.
 */
export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo);

  if (!parsed.key || event.key.toLowerCase() !== parsed.key) {
    return false;
  }

  if (parsed.mod) {
    if (!event.metaKey && !event.ctrlKey) {
      return false;
    }
  } else {
    if (event.metaKey !== parsed.meta || event.ctrlKey !== parsed.ctrl) {
      return false;
    }
  }

  if (event.altKey !== parsed.alt) {
    return false;
  }

  const shiftIsMeaningful = parsed.shift || parsed.key.length > 1 || /^[a-z0-9]$/.test(parsed.key);

  return !shiftIsMeaningful || event.shiftKey === parsed.shift;
}

/** Whether the combo names the portable or an explicit control modifier. */
function hasControlModifier(combo: string): boolean {
  const parsed = parseCombo(combo);

  return parsed.mod || parsed.meta || parsed.ctrl;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export interface UseShortcutsOptions {
  /** `false` detaches the listener entirely — for a screen that hands keys to a child. */
  enabled?: boolean;
}

/**
 * Binds `shortcuts` to `window` for the lifetime of the component.
 *
 * The array may be rebuilt on every render; only `enabled` re-subscribes. First
 * match wins, so a component that registers two combos sharing a key should list
 * the more specific one first.
 */
export function useShortcuts(shortcuts: readonly Shortcut[], options: UseShortcutsOptions = {}) {
  const enabled = options.enabled ?? true;

  // Written during render on purpose: the listener below must see the closures from
  // the render that is committing, and an effect that copied them would be one
  // render behind for the keypress that arrives between commit and effect.
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      // `isComposing` is an IME candidate window: those keystrokes belong to the
      // input method. `defaultPrevented` means something closer to the event —
      // a dialog's escape handling, an editor's own binding — already owned it.
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      for (const shortcut of latest.current) {
        if (shortcut.enabled === false || !matchesCombo(event, shortcut.combo)) {
          continue;
        }

        const allowInInput = shortcut.allowInInput ?? hasControlModifier(shortcut.combo);

        if (!allowInInput && isEditableTarget(event.target)) {
          continue;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }

        shortcut.handler(event);

        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

/** Apple platforms label `mod` as ⌘ and order modifiers differently. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

const APPLE_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};

const PC_NAMES: Record<string, string> = {
  mod: "Ctrl",
  meta: "Win",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};

/** Printable names for keys whose `event.key` spelling is not presentable. */
const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "↵",
  escape: "Esc",
  backspace: "⌫",
  delete: "Del",
};

/**
 * Renders a combo the way the platform writes it: `⇧⌘Z` on a Mac, `Ctrl+Shift+Z`
 * elsewhere. Order is each platform's own convention — ⌃⌥⇧⌘ on Apple, where the
 * command key sits next to the letter, and Ctrl+Alt+Shift on a PC, where it leads —
 * and it is fixed, so the same combo reads the same however the call site wrote it.
 */
export function formatShortcut(combo: string, apple: boolean = isApplePlatform()): string {
  const parsed = parseCombo(combo);
  const symbols = apple ? APPLE_SYMBOLS : PC_NAMES;

  const middle = [parsed.alt ? symbols.alt : null, parsed.shift ? symbols.shift : null];

  const key =
    KEY_LABELS[parsed.key] ??
    (parsed.key.length === 1 ? parsed.key.toUpperCase() : capitalize(parsed.key));

  // ⌘ trails the other modifiers on Apple and Ctrl leads them on a PC, so `mod` lands
  // on a different side of the run depending on which key it resolves to.
  const ordered = apple
    ? [parsed.ctrl ? symbols.ctrl : null, ...middle, parsed.mod || parsed.meta ? symbols.mod : null]
    : [parsed.mod || parsed.ctrl ? symbols.ctrl : parsed.meta ? symbols.meta : null, ...middle];

  const parts = [...ordered, key].filter((part): part is string => part !== null);

  return apple ? parts.join("") : parts.join("+");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The formatted combo, or `null` until after hydration.
 *
 * The label depends on `navigator`, which the server does not have: rendering
 * `Ctrl+K` on the server and `⌘K` on a Mac client is a hydration mismatch, and
 * React replaces the whole subtree when it finds one. Returning `null` for the
 * first client render keeps both passes identical and lets the caller render
 * nothing rather than the wrong hint.
 */
export function useShortcutLabel(combo: string): string | null {
  const [apple, setApple] = useState<boolean | null>(null);

  useEffect(() => setApple(isApplePlatform()), []);

  return apple === null ? null : formatShortcut(combo, apple);
}
