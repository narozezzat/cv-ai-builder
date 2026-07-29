import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AiActionResult } from "../lib/ai-action-result";
import type { AiSuggestion } from "../lib/suggestion";
import { AiSuggestionPopover, type AiAcceptPayload } from "./ai-suggestion-popover";

/**
 * The contract fifteen call sites depend on, asserted once.
 *
 * These are not layout assertions. Each one is a rule the popover exists to enforce
 * centrally, and each is invisible until it breaks somewhere expensive: a rejected
 * suggestion that reached the store would sit in undo history, a second charge for
 * paging a variant already paid for would come out of the user's credits, and an
 * accept that emitted the wrong payload kind would write a string into a list field.
 */

type Variant = { text: string; label?: string; notes?: string[] };

function ok<TData>(data: TData, creditsRemaining = 41): AiActionResult<TData> {
  return { ok: true, data, creditsRemaining };
}

interface HarnessProps {
  value?: AiAcceptPayload;
  variants?: Variant[];
  run?: () => Promise<AiActionResult<Variant[]>>;
  onAccept?: (payload: AiAcceptPayload) => void;
}

/** Text capability: one prose suggestion, reviewed as a word diff. */
function TextHarness({
  value = { kind: "text", text: "Engineer with five years of experience." },
  variants = [{ text: "Engineer who ships payments infrastructure." }],
  run = () => Promise.resolve(ok(variants)),
  onAccept = () => {},
}: HarnessProps) {
  return (
    <AiSuggestionPopover
      label="Write with AI"
      title="Summary"
      value={value}
      run={run}
      toSuggestions={(data) =>
        data.map((variant, index): AiSuggestion => ({
          kind: "text",
          id: `s-${index}`,
          label: variant.label,
          notes: variant.notes,
          text: variant.text,
        }))
      }
      onAccept={onAccept}
    />
  );
}

interface ListHarnessProps {
  value?: string[];
  items?: string[];
  mode?: "append" | "replace";
  onAccept?: (payload: AiAcceptPayload) => void;
}

/** List capability: additive by default, which is how `skills.suggest` behaves. */
function ListHarness({
  value = ["React"],
  items = ["React", "Postgres", "Terraform"],
  mode = "append",
  onAccept = () => {},
}: ListHarnessProps) {
  return (
    <AiSuggestionPopover
      label="Suggest skills"
      title="Skills"
      value={{ kind: "list", items: value }}
      run={() => Promise.resolve(ok(items))}
      toSuggestions={(data): AiSuggestion[] => [{ kind: "list", id: "l-0", mode, items: data }]}
      limits={{ maxItems: 3, maxLength: 40 }}
      onAccept={onAccept}
    />
  );
}

function openPopover(user: ReturnType<typeof userEvent.setup>, label: string) {
  return user.click(screen.getByRole("button", { name: new RegExp(label) }));
}

/**
 * A word diff is one span per segment with an `sr-only` op prefix inside it, so no
 * single element holds a whole suggestion. Asserting on the popup's text is the
 * assertion that survives resegmentation.
 */
async function expectPopoverToSay(text: string) {
  await waitFor(() => {
    expect(screen.getByRole("dialog").textContent ?? "").toContain(text);
  });
}

describe("AiSuggestionPopover", () => {
  it("requests on open, without a second click on a Generate button", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() => Promise.resolve(ok([{ text: "Ships payments infrastructure." }])));

    render(<TextHarness run={run} />);

    expect(run).not.toHaveBeenCalled();

    await openPopover(user, "Write with AI");

    await expectPopoverToSay("payments infrastructure");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("emits the field's payload kind on accept, then closes", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(<TextHarness onAccept={onAccept} />);

    await openPopover(user, "Write with AI");
    await user.click(await screen.findByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith({
      kind: "text",
      text: "Engineer who ships payments infrastructure.",
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    });
  });

  it("writes nothing when the suggestion is discarded", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(<TextHarness onAccept={onAccept} />);

    await openPopover(user, "Write with AI");
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("discards on Escape too — closing by any means is the rejection", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(<TextHarness onAccept={onAccept} />);

    await openPopover(user, "Write with AI");
    await screen.findByRole("button", { name: "Accept" });
    await user.keyboard("{Escape}");

    expect(onAccept).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    });
  });

  it("forgets the last suggestion, so reopening asks again", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() => Promise.resolve(ok([{ text: "Ships payments infrastructure." }])));

    render(<TextHarness run={run} />);

    await openPopover(user, "Write with AI");
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    await openPopover(user, "Write with AI");

    await screen.findByRole("button", { name: "Accept" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("pages a cached variant without spending another credit", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() =>
      Promise.resolve(
        ok([
          { text: "First variant.", label: "Achievement-led" },
          { text: "Second variant.", label: "Skills-led" },
        ]),
      ),
    );

    render(<TextHarness run={run} />);

    await openPopover(user, "Write with AI");

    // The label says which of the two the button will do.
    const paging = await screen.findByRole("button", { name: "Next option" });

    expect(screen.getByText(/Option 1 of 2/)).toBeInTheDocument();

    await user.click(paging);

    expect(screen.getByText(/Option 2 of 2/)).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("spends a credit once the cached variants run out", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() => Promise.resolve(ok([{ text: "Only variant." }])));

    render(<TextHarness run={run} />);

    await openPopover(user, "Write with AI");
    await user.click(await screen.findByRole("button", { name: "Regenerate" }));

    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
    });
  });

  it("refuses to accept a suggestion identical to what is already there", async () => {
    const user = userEvent.setup();

    render(
      <TextHarness
        value={{ kind: "text", text: "Engineer who ships things." }}
        variants={[{ text: "Engineer who ships things." }]}
      />,
    );

    await openPopover(user, "Write with AI");

    expect(await screen.findByText(/matches what you already have/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });

  it("renders the failure's own copy and the action that can resolve it", async () => {
    const user = userEvent.setup();
    const run = vi
      .fn<() => Promise<AiActionResult<Variant[]>>>()
      .mockResolvedValueOnce({
        ok: false,
        code: "provider_unavailable",
        error: "The AI provider is unavailable right now.",
        retryable: true,
      })
      .mockResolvedValue(ok([{ text: "Second time lucky." }]));

    render(<TextHarness run={run} />);

    await openPopover(user, "Write with AI");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI provider is unavailable right now.",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await expectPopoverToSay("Second time lucky");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers no retry for a failure retrying cannot fix", async () => {
    const user = userEvent.setup();
    const run = vi.fn((): Promise<AiActionResult<Variant[]>> =>
      Promise.resolve({
        ok: false,
        code: "rate_limited",
        error: "Too many AI requests. Try again in a minute.",
        retryable: false,
      }),
    );

    render(<TextHarness run={run} />);

    await openPopover(user, "Write with AI");

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("says so when the model returned nothing usable", async () => {
    const user = userEvent.setup();

    render(<TextHarness run={() => Promise.resolve(ok([]))} />);

    await openPopover(user, "Write with AI");

    expect(await screen.findByText(/Regenerating usually fixes it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });

  it("shows the balance the charge left behind", async () => {
    const user = userEvent.setup();

    render(<TextHarness run={() => Promise.resolve(ok([{ text: "One variant." }], 7))} />);

    await openPopover(user, "Write with AI");

    expect(await screen.findByText("7 credits left")).toBeInTheDocument();
  });

  it("offers only the additions a list does not already contain", async () => {
    const user = userEvent.setup();

    render(<ListHarness value={["React"]} items={["react", "Postgres"]} />);

    await openPopover(user, "Suggest skills");

    // Case-insensitively already present, so ticking it would accept a no-op.
    expect(await screen.findByRole("checkbox", { name: "Postgres" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /react/i })).not.toBeInTheDocument();
  });

  it("merges only the ticked additions, under the field's caps", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(<ListHarness value={["React"]} onAccept={onAccept} />);

    await openPopover(user, "Suggest skills");

    // Everything the field lacks is ticked by default, so untick what should not land.
    await user.click(await screen.findByRole("checkbox", { name: "Terraform" }));
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith({ kind: "list", items: ["React", "Postgres"] });
  });

  it("cannot accept an additive suggestion with nothing ticked", async () => {
    const user = userEvent.setup();

    render(<ListHarness value={["React"]} items={["Postgres"]} />);

    await user.click(screen.getByRole("button", { name: /Suggest skills/ }));
    await user.click(await screen.findByRole("checkbox", { name: "Postgres" }));

    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });

  it("accepts a replacement as the whole list, capped", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    render(
      <ListHarness
        mode="replace"
        value={["React"]}
        items={["Go", "Rust", "Elixir", "Zig"]}
        onAccept={onAccept}
      />,
    );

    await openPopover(user, "Suggest skills");
    await user.click(await screen.findByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith({ kind: "list", items: ["Go", "Rust", "Elixir"] });
  });

  it("does not request from a trigger whose prerequisite is unmet", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() => Promise.resolve(ok([{ text: "Never asked for." }])));

    render(
      <AiSuggestionPopover
        label="Improve bullets"
        title="Highlights"
        value={{ kind: "list", items: [] }}
        run={run}
        toSuggestions={(): AiSuggestion[] => []}
        disabled
        disabledReason="Add a job title first"
        onAccept={() => {}}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Improve bullets/ });

    expect(trigger).toBeDisabled();
    // The reason is the only thing telling a screen reader why the trigger is dead.
    expect(trigger).toHaveTextContent("Add a job title first");

    await user.click(trigger);

    expect(run).not.toHaveBeenCalled();
  });
});
