/**
 * The parts of the request lifecycle the popover's own tests cannot reach.
 *
 * A server action is a `fetch` whose signal we do not hold, so a response always
 * arrives — after the user closed the popover, after the component unmounted, after a
 * newer request superseded it. What is asserted here is that none of those late
 * arrivals commit: one would resurrect a popover the user dismissed, and the React
 * warning it produces is the least of it.
 */

import { act, render, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AiActionResult } from "../lib/ai-action-result";
import type { TextSuggestion } from "../lib/suggestion";
import { useAiSuggestion } from "./use-ai-suggestion";

type Data = { text: string };

function toSuggestions(data: Data): TextSuggestion[] {
  return [{ kind: "text", id: "s-0", text: data.text }];
}

/** A request whose resolution the test decides, so "in flight" is a real state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function renderSuggestion(run: () => Promise<AiActionResult<Data>>) {
  return renderHook(() => useAiSuggestion({ run, toSuggestions }));
}

describe("useAiSuggestion", () => {
  it("starts idle, so opening a popover is what triggers the first request", () => {
    const run = vi.fn(() => Promise.resolve<AiActionResult<Data>>({} as never));
    const { result } = renderSuggestion(run);

    expect(result.current.status).toBe("idle");
    expect(result.current.current).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("ignores a response that lands after reset", async () => {
    const pending = deferred<AiActionResult<Data>>();
    const { result } = renderSuggestion(() => pending.promise);

    act(() => result.current.request());
    expect(result.current.status).toBe("loading");

    act(() => result.current.reset());

    await act(async () => {
      pending.resolve({ ok: true, data: { text: "Too late." }, creditsRemaining: 3 });
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.suggestions).toHaveLength(0);
  });

  it("ignores a superseded response, keeping only the newest", async () => {
    const first = deferred<AiActionResult<Data>>();
    const second = deferred<AiActionResult<Data>>();
    const runs = [() => first.promise, () => second.promise];
    let call = 0;

    const { result } = renderSuggestion(() => runs[call++]());

    act(() => result.current.request());
    act(() => result.current.request());

    // Resolved out of order, which is the whole reason the guard is an id and not a
    // boolean: the older request answering last must not win.
    await act(async () => {
      second.resolve({ ok: true, data: { text: "Newest." }, creditsRemaining: 2 });
    });
    await act(async () => {
      first.resolve({ ok: true, data: { text: "Stale." }, creditsRemaining: 9 });
    });

    expect(result.current.current?.text).toBe("Newest.");
    expect(result.current.creditsRemaining).toBe(2);
  });

  it("does not commit a response that lands after unmount", async () => {
    const pending = deferred<AiActionResult<Data>>();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    function Harness() {
      const suggestion = useAiSuggestion({ run: () => pending.promise, toSuggestions });

      return (
        <button type="button" onClick={suggestion.request}>
          {suggestion.status}
        </button>
      );
    }

    const view = render(<Harness />);

    act(() => view.getByRole("button").click());
    view.unmount();

    await act(async () => {
      pending.resolve({ ok: true, data: { text: "Orphan." }, creditsRemaining: 1 });
    });

    // A commit on an unmounted component is a React warning, not a throw.
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("re-reads `run` on every request, so call sites need no memoization", async () => {
    let field = "first";
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAiSuggestion({
          run: () =>
            Promise.resolve<AiActionResult<Data>>({
              ok: true,
              data: { text: value },
              creditsRemaining: 5,
            }),
          toSuggestions,
        }),
      { initialProps: { value: field } },
    );

    await act(async () => result.current.request());
    expect(result.current.current?.text).toBe("first");

    field = "second";
    rerender({ value: field });

    await act(async () => result.current.request());
    expect(result.current.current?.text).toBe("second");
  });

  it("pages cached variants before it charges again", async () => {
    const run = vi.fn((): Promise<AiActionResult<Data>> =>
      Promise.resolve({ ok: true, data: { text: "Two variants." }, creditsRemaining: 4 }),
    );

    const { result } = renderHook(() =>
      useAiSuggestion({
        run,
        toSuggestions: (data: Data): TextSuggestion[] => [
          { kind: "text", id: "s-0", text: data.text },
          { kind: "text", id: "s-1", text: `${data.text} Second.` },
        ],
      }),
    );

    await act(async () => result.current.request());

    expect(result.current.nextCostsCredit).toBe(false);

    await act(async () => result.current.next());

    expect(result.current.index).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
    // Last variant reached, so the next press is a fresh charge.
    expect(result.current.nextCostsCredit).toBe(true);

    await act(async () => result.current.next());

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("surfaces an action failure with its code intact", async () => {
    const { result } = renderSuggestion(() =>
      Promise.resolve<AiActionResult<Data>>({
        ok: false,
        code: "insufficient_credits",
        error: "You are out of AI credits.",
        retryable: false,
      }),
    );

    await act(async () => result.current.request());

    expect(result.current.status).toBe("error");
    expect(result.current.failure?.code).toBe("insufficient_credits");
    expect(result.current.current).toBeNull();
  });

  it("turns a transport failure into a retryable one, since the charge is unknowable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderSuggestion(() => Promise.reject(new Error("socket hang up")));

    await act(async () => result.current.request());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.failure).toMatchObject({ code: "unknown", retryable: true });
    // The provider's own message never reaches the user; the log is where it goes.
    expect(result.current.failure?.error).not.toContain("socket");
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("reports empty separately from ready, because the fix is different", async () => {
    const { result } = renderHook(() =>
      useAiSuggestion({
        run: () =>
          Promise.resolve<AiActionResult<Data>>({
            ok: true,
            data: { text: "" },
            creditsRemaining: 6,
          }),
        toSuggestions: (): TextSuggestion[] => [],
      }),
    );

    await act(async () => result.current.request());

    expect(result.current.status).toBe("empty");
    // The credit was still spent, so the balance still moves.
    expect(result.current.creditsRemaining).toBe(6);
  });
});
