import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CommandPaletteProvider,
  useRegisterCommands,
  type CommandAction,
} from "./command-palette-provider";

const push = vi.fn();
const setTheme = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme }),
}));

beforeEach(() => {
  push.mockClear();
  setTheme.mockClear();
});

function Contributor({ actions }: { actions: readonly CommandAction[] }) {
  useRegisterCommands(actions);

  return null;
}

async function openPalette(): Promise<void> {
  await userEvent.keyboard("{Meta>}k{/Meta}");
  await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
}

describe("CommandPaletteProvider", () => {
  it("opens and closes on the shortcut", async () => {
    render(
      <CommandPaletteProvider>
        <div>app</div>
      </CommandPaletteProvider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openPalette();
    // The dialog's name has to come from inside the popup, or assistive tech
    // announces an unnamed dialog.
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Command palette");

    await userEvent.keyboard("{Meta>}k{/Meta}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("navigates and closes when a built-in command is chosen", async () => {
    render(
      <CommandPaletteProvider>
        <div>app</div>
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.click(screen.getByRole("option", { name: /trash/i }));

    expect(push).toHaveBeenCalledWith("/dashboard/trash");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps itself open for a `keepOpen` command", async () => {
    render(
      <CommandPaletteProvider>
        <div>app</div>
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.click(screen.getByRole("option", { name: /dark theme/i }));

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("filters by keyword as well as by label", async () => {
    render(
      <CommandPaletteProvider>
        <div>app</div>
      </CommandPaletteProvider>,
    );

    await openPalette();
    // "bin" appears in no label — only in Trash's keywords.
    await userEvent.type(screen.getByRole("combobox"), "bin");

    await waitFor(() => expect(screen.getByRole("option", { name: /trash/i })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: /dark theme/i })).not.toBeInTheDocument();
  });

  it("shows contextual commands and drops them when their owner unmounts", async () => {
    const perform = vi.fn();
    const actions: CommandAction[] = [
      { id: "test.thing", label: "Do the thing", group: "context", perform },
    ];

    const { rerender } = render(
      <CommandPaletteProvider>
        <Contributor actions={actions} />
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.click(screen.getByRole("option", { name: "Do the thing" }));
    expect(perform).toHaveBeenCalledTimes(1);

    rerender(
      <CommandPaletteProvider>
        <div>no contributor</div>
      </CommandPaletteProvider>,
    );

    await openPalette();
    // A command whose owner is gone would run a handler closing over an unmounted
    // component — it must not be offered at all.
    expect(screen.queryByRole("option", { name: "Do the thing" })).not.toBeInTheDocument();
  });

  /**
   * The stale-closure regression: callers rebuild the action array every render, and a
   * registry that captured the first `perform` would run a handler holding the state
   * from whenever the component happened to mount.
   */
  it("runs the handler from the latest render", async () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(
      <CommandPaletteProvider>
        <Contributor
          actions={[{ id: "test.thing", label: "Thing", group: "context", perform: first }]}
        />
      </CommandPaletteProvider>,
    );

    rerender(
      <CommandPaletteProvider>
        <Contributor
          actions={[{ id: "test.thing", label: "Thing", group: "context", perform: second }]}
        />
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.click(screen.getByRole("option", { name: "Thing" }));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("survives a command that throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <CommandPaletteProvider>
        <Contributor
          actions={[
            {
              id: "test.boom",
              label: "Boom",
              group: "context",
              perform: () => {
                throw new Error("nope");
              },
            },
          ]}
        />
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.click(screen.getByRole("option", { name: "Boom" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("reports an empty result rather than an empty list", async () => {
    render(
      <CommandPaletteProvider>
        <div>app</div>
      </CommandPaletteProvider>,
    );

    await openPalette();
    await userEvent.type(screen.getByRole("combobox"), "zzzzzz");

    await waitFor(() => expect(screen.getByText("No matching command.")).toBeInTheDocument());
  });
});
