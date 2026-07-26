import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPage } from "@/components/shared";

describe("StatusPage", () => {
  it("renders a main landmark with the skip-link target id", () => {
    // The root layout's skip link points at `#main`. `not-found.tsx` and
    // `error.tsx` replace the page rather than the layout, so this component is
    // the only thing providing that landmark on those screens.
    render(<StatusPage code="404" title="Not found" description="Gone." />);

    const main = screen.getByRole("main");

    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("id", "main");
  });

  it("exposes the title as the page's h1", () => {
    render(<StatusPage code="404" title="Not found" description="Gone." />);

    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });

  it("omits the action row when no actions are given", () => {
    const { container } = render(
      <StatusPage code="Error" title="Broken" description="Try again." />,
    );

    expect(container.querySelectorAll("button, a")).toHaveLength(0);
  });

  it("renders provided actions", () => {
    render(
      <StatusPage
        code="404"
        title="Not found"
        description="Gone."
        actions={<button type="button">Back home</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Back home" })).toBeInTheDocument();
  });
});
