import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

/**
 * jsdom implements neither `matchMedia` nor the observer APIs, and the UI layer
 * depends on both: `next-themes` reads the system colour scheme, Framer Motion
 * reads `prefers-reduced-motion`, and Base UI primitives observe element size
 * to position popups. Without these stubs most component tests throw before
 * they assert anything.
 */
beforeAll(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  );

  class ObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("ResizeObserver", ObserverStub);
  vi.stubGlobal("IntersectionObserver", ObserverStub);

  // Guarded because `setupFiles` runs for every test file, including the ones
  // that opt into the `node` environment with a `@vitest-environment` docblock.
  // There is no DOM there, so touching `Element` unconditionally would fail the
  // integration tests before they reach a single assertion.
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});
