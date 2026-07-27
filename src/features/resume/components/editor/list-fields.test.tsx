import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { BulletListField, KeywordListField } from "./list-fields";

/**
 * These two components hold the only non-trivial input logic in the editor —
 * everything else is "value in, store write out". The behaviours asserted here are
 * the ones a user notices immediately when they break: a pasted comma list that
 * arrives as one chip, a duplicate that gets added twice, and a bullet that moves
 * the wrong way.
 */

/** Wires a component up to real state, since these are controlled. */
function Harness({
  initial = [] as string[],
  kind,
}: {
  initial?: string[];
  kind: "keyword" | "bullet";
}) {
  const [value, setValue] = useState(initial);

  return kind === "keyword" ? (
    <KeywordListField
      label="Technologies"
      value={value}
      onChange={setValue}
      maxItems={3}
      maxLength={20}
    />
  ) : (
    <BulletListField
      label="Highlights"
      value={value}
      onChange={setValue}
      maxItems={3}
      maxLength={100}
    />
  );
}

describe("KeywordListField", () => {
  it("adds a chip on Enter", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" />);

    await user.type(screen.getByLabelText("Technologies"), "TypeScript{Enter}");

    expect(screen.getByRole("button", { name: "Remove TypeScript" })).toBeInTheDocument();
    // The input clears, or the next keyword is typed onto the end of this one.
    expect(screen.getByLabelText("Technologies")).toHaveValue("");
  });

  it("splits a comma-separated list into separate chips", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" />);

    // How requirements arrive when copied out of a job posting.
    await user.type(screen.getByLabelText("Technologies"), "React, Postgres,");

    expect(screen.getByRole("button", { name: "Remove React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Postgres" })).toBeInTheDocument();
  });

  it("drops a duplicate regardless of case", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" initial={["React"]} />);

    await user.type(screen.getByLabelText("Technologies"), "react{Enter}");

    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
  });

  it("stops at the cap instead of silently discarding the rest", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" />);

    await user.type(screen.getByLabelText("Technologies"), "a, b, c, d,");

    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(3);
    // Disabled with the reason in the placeholder, not an input that swallows text.
    expect(screen.getByLabelText("Technologies")).toBeDisabled();
  });

  it("removes the last chip on Backspace in an empty input", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" initial={["React", "Postgres"]} />);

    await user.click(screen.getByLabelText("Technologies"));
    await user.keyboard("{Backspace}");

    expect(screen.queryByRole("button", { name: "Remove Postgres" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove React" })).toBeInTheDocument();
  });

  it("commits a half-typed keyword on blur rather than losing it", async () => {
    const user = userEvent.setup();

    render(<Harness kind="keyword" />);

    await user.type(screen.getByLabelText("Technologies"), "Terraform");
    await user.tab();

    expect(screen.getByRole("button", { name: "Remove Terraform" })).toBeInTheDocument();
  });
});

describe("BulletListField", () => {
  it("adds an empty bullet ready to type into", async () => {
    const user = userEvent.setup();

    render(<Harness kind="bullet" />);

    await user.click(screen.getByRole("button", { name: "Add bullet" }));

    expect(screen.getByLabelText("Highlights 1")).toBeInTheDocument();
  });

  it("moves a bullet up, and disables the control at the top", async () => {
    const user = userEvent.setup();

    render(<Harness kind="bullet" initial={["first", "second"]} />);

    await user.click(screen.getByRole("button", { name: "Move Highlights 2 up" }));

    expect(screen.getByLabelText("Highlights 1")).toHaveValue("second");
    expect(screen.getByLabelText("Highlights 2")).toHaveValue("first");
    expect(screen.getByRole("button", { name: "Move Highlights 1 up" })).toBeDisabled();
  });

  it("removes the bullet the button belongs to, not the last one", async () => {
    const user = userEvent.setup();

    render(<Harness kind="bullet" initial={["first", "second", "third"]} />);

    await user.click(screen.getByRole("button", { name: "Remove Highlights 2" }));

    expect(screen.getByLabelText("Highlights 1")).toHaveValue("first");
    expect(screen.getByLabelText("Highlights 2")).toHaveValue("third");
  });

  it("disables adding at the cap", async () => {
    const user = userEvent.setup();

    render(<Harness kind="bullet" initial={["a", "b"]} />);

    await user.click(screen.getByRole("button", { name: "Add bullet" }));

    expect(screen.getByRole("button", { name: "Add bullet" })).toBeDisabled();
  });
});
