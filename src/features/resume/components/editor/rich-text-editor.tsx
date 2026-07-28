"use client";

/**
 * The TipTap instance behind every rich-text field.
 *
 * The schema, the length cap, and the undo bindings live in
 * [rich-text-extensions.ts](./rich-text-extensions.ts); this file is the chrome
 * around them — toolbar, link popover, and the two-way sync with the store.
 */

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Bold as BoldIcon, Italic as ItalicIcon, Link2, Link2Off, List } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isSafeHttpUrl } from "@/types/resume";

import { richTextExtensions } from "./rich-text-extensions";

export interface RichTextEditorProps {
  /** Stored HTML. `""` for an untouched field. */
  value: string;
  /** Called with HTML, or `""` when the document is empty. */
  onChange: (html: string) => void;
  /**
   * Ceiling on the *HTML* length, matching the Zod bound on the field. Markup
   * counts, because markup is what gets stored and re-validated on the server.
   */
  maxLength: number;
  placeholder?: string;
  /** Id for the contenteditable element. */
  id: string;
  /**
   * Id of the visible label. `aria-labelledby` rather than `<label for>` because the
   * control is a contenteditable div, which is not a labelable element — `htmlFor`
   * pointing at it names nothing.
   */
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  onUndo?: () => void;
  onRedo?: () => void;
}

/** `""` rather than TipTap's `<p></p>` for an empty document — see `isRichTextEmpty`. */
function readHtml(editor: { isEmpty: boolean; getHTML: () => string }): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

export function RichTextEditor({
  value,
  onChange,
  maxLength,
  placeholder,
  id,
  ariaLabelledBy,
  ariaDescribedBy,
  onUndo,
  onRedo,
}: RichTextEditorProps) {
  const editor = useEditor({
    // The field is rendered by a client-only dynamic import, but `useEditor`
    // still runs its first pass before hydration; rendering immediately there
    // produces a mismatch warning.
    immediatelyRender: false,
    extensions: richTextExtensions({ maxLength, placeholder, onUndo, onRedo }),
    content: value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": ariaLabelledBy,
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        class:
          "min-h-24 w-full px-3 py-2 text-sm outline-none [&_a]:underline [&_a]:decoration-dotted [&_p]:min-h-5 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(readHtml(instance)),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            bulletList: instance.isActive("bulletList"),
            link: instance.isActive("link"),
            href: (instance.getAttributes("link").href as string | undefined) ?? "",
          }
        : null,
  });

  // External writes — undo/redo, a restored version, an accepted AI suggestion —
  // arrive as a changed `value`. Compare against what the editor holds rather
  // than tracking "who wrote last": every local keystroke has already round-tripped
  // through the store, so the values match and this does nothing, which is what
  // keeps the caret from jumping to the end of the field on every character.
  useEffect(() => {
    if (!editor) return;
    if (value === readHtml(editor)) return;

    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <div
        role="group"
        aria-label="Text formatting"
        className="flex items-center gap-0.5 border-b border-input/70 px-1 py-1"
      >
        <IconButton
          label="Bold"
          shortcut="⌘B"
          size="icon-sm"
          icon={<BoldIcon aria-hidden className="size-3.5" />}
          aria-pressed={state?.bold ?? false}
          className={cn(state?.bold && "bg-accent text-accent-foreground")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <IconButton
          label="Italic"
          shortcut="⌘I"
          size="icon-sm"
          icon={<ItalicIcon aria-hidden className="size-3.5" />}
          aria-pressed={state?.italic ?? false}
          className={cn(state?.italic && "bg-accent text-accent-foreground")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <IconButton
          label="Bullet list"
          size="icon-sm"
          icon={<List aria-hidden className="size-3.5" />}
          aria-pressed={state?.bulletList ?? false}
          className={cn(state?.bulletList && "bg-accent text-accent-foreground")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />

        <LinkControl
          active={state?.link ?? false}
          href={state?.href ?? ""}
          disabled={!editor}
          onSubmit={(href) =>
            editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
          }
          onRemove={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

interface LinkControlProps {
  active: boolean;
  href: string;
  disabled: boolean;
  onSubmit: (href: string) => void;
  onRemove: () => void;
}

/**
 * Add or edit the link on the selection.
 *
 * A popover with a real text input rather than `window.prompt`: prompt is blocked
 * in some browsers, unstyleable, and gives no way to show why a `javascript:` URL
 * was refused.
 */
function LinkControl({ active, href, disabled, onSubmit, onRemove }: LinkControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  function openWith(next: boolean): void {
    setOpen(next);
    if (next) {
      setDraft(href);
      setError(undefined);
    }
  }

  function submit(): void {
    const trimmed = draft.trim();
    // Bare domains are what people type. Prefixing before validating means
    // "example.com" works and "javascript:alert(1)" still cannot.
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

    if (!isSafeHttpUrl(candidate)) {
      setError("Enter a web address starting with http:// or https://.");
      return;
    }

    onSubmit(candidate);
    setOpen(false);
  }

  return (
    <span className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={openWith}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={active ? "Edit link" : "Add link"}
              aria-pressed={active}
              disabled={disabled}
              className={cn(active && "bg-accent text-accent-foreground")}
            >
              <Link2 aria-hidden className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-72 space-y-2">
          <Input
            autoFocus
            value={draft}
            placeholder="https://example.com"
            aria-label="Link address"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // The field sits inside the section form; Enter here means "apply
              // this link", not "submit whatever encloses me".
              event.preventDefault();
              submit();
            }}
          />
          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={submit}>
              {active ? "Update" : "Add link"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {active ? (
        <IconButton
          label="Remove link"
          size="icon-sm"
          icon={<Link2Off aria-hidden className="size-3.5" />}
          disabled={disabled}
          onClick={onRemove}
        />
      ) : null}
    </span>
  );
}
