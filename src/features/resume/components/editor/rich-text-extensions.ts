/**
 * The rich-text schema, as an allowlist you can read.
 *
 * Extensions are imported one at a time instead of via StarterKit: paragraph, hard
 * break, bold, italic, bullet list, link, and nothing else. A resume is not a
 * document — headings, blockquotes, code blocks, tables, and images would each have
 * to be rendered by twenty templates and by Puppeteer's print path, and none of them
 * survive an ATS parser. What the schema cannot express, a paste cannot smuggle in,
 * which is the point.
 *
 * Deliberately no `History` extension. Undo belongs to the resume store, which owns
 * the whole document — a per-field stack would let ⌘Z inside a description undo prose
 * while the section reorder that happened after it stays. `Mod-z` is bound to the
 * store's step instead, so the native contenteditable undo never fires and
 * desynchronises ProseMirror's state from the DOM.
 *
 * A plain module rather than part of the editor component so the schema and the
 * length cap can be exercised against a headless `Editor` in tests, without React
 * and without the `next/dynamic` boundary in front of them.
 */

import { Extension, getHTMLFromFragment, type Extensions } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { BulletList } from "@tiptap/extension-bullet-list";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list-item";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Text } from "@tiptap/extension-text";
import { Plugin } from "@tiptap/pm/state";

import { isSafeHttpUrl } from "@/types/resume";

export interface RichTextExtensionOptions {
  /**
   * Ceiling on the *HTML* length, matching the Zod bound on the field. Markup
   * counts, because markup is what gets stored and re-validated on the server.
   */
  maxLength: number;
  placeholder?: string;
  onUndo?: () => void;
  onRedo?: () => void;
}

/**
 * The hard length cap, enforced where the user cannot get around it: a transaction
 * that would push the serialized HTML past the field's Zod bound is rejected
 * outright, so typing, pasting, and bolding all stop at the same place instead of
 * failing later at save time against a limit nobody saw.
 *
 * A ProseMirror plugin, not `editorProps`: `filterTransaction` belongs to the plugin
 * spec, so passing it as an editor prop is silently ignored — a cap that reads as
 * enforced and is not.
 */
function htmlLengthCap(maxLength: number) {
  return Extension.create({
    name: "htmlLengthCap",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction: (transaction) => {
            if (!transaction.docChanged) return true;

            // Cheap gate first: HTML is never shorter than the text it wraps, so a
            // document whose text alone exceeds the cap cannot pass.
            if (transaction.doc.textContent.length > maxLength) return false;

            const html = getHTMLFromFragment(transaction.doc.content, transaction.doc.type.schema);

            return html.length <= maxLength;
          },
        }),
      ];
    },
  });
}

function documentHistory(onUndo?: () => void, onRedo?: () => void) {
  return Extension.create({
    name: "documentHistory",
    addKeyboardShortcuts() {
      // Returning true swallows the event either way: with no handler wired, a
      // silent no-op still beats the browser mutating the DOM underneath
      // ProseMirror, which leaves the editor and its state disagreeing.
      const step = (handler?: () => void) => () => {
        handler?.();
        return true;
      };

      return {
        "Mod-z": step(onUndo),
        "Mod-Shift-z": step(onRedo),
        "Mod-y": step(onRedo),
      };
    },
  });
}

export function richTextExtensions({
  maxLength,
  placeholder,
  onUndo,
  onRedo,
}: RichTextExtensionOptions): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Bold,
    Italic,
    BulletList,
    ListItem,
    Link.configure({
      openOnClick: false,
      // No stored `target`/`rel`: the sanitizer is subtractive, so any attribute
      // written here would be stripped on save and reappear on every load, making
      // the field look dirty when nothing changed. The renderer adds
      // `rel="noopener noreferrer"` at print/preview time instead.
      HTMLAttributes: {},
      // Both hooks, not the deprecated `validate`: `isAllowedUri` gates what a link
      // mark may hold, `shouldAutoLink` gates what typing a URL turns into one. Same
      // absolute-http test the server sanitizer applies.
      isAllowedUri: (url) => isSafeHttpUrl(url),
      shouldAutoLink: (url) => isSafeHttpUrl(url),
    }),
    Placeholder.configure({ placeholder: placeholder ?? "" }),
    htmlLengthCap(maxLength),
    documentHistory(onUndo, onRedo),
  ];
}
