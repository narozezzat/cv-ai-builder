import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/components/shared";

/**
 * These are security tests, not formatting tests.
 *
 * Share pages will pass user-controlled strings (resume titles, headlines) into
 * this component. If `<` survives serialization, a title containing
 * `</script><img onerror=…>` closes the JSON block early and the remainder is
 * parsed as live markup by the browser — stored XSS on a public page.
 */
describe("JsonLd", () => {
  it("emits parseable ld+json", () => {
    const { container } = render(<JsonLd data={{ "@type": "WebSite", name: "Reforge" }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent ?? "")).toEqual({
      "@type": "WebSite",
      name: "Reforge",
    });
  });

  it("escapes every '<' so a payload cannot close the script tag", () => {
    const { container } = render(
      <JsonLd
        data={{
          "@type": "WebPage",
          name: '</script><img src=x onerror="alert(1)">',
        }}
      />,
    );

    const raw = container.querySelector("script")!.innerHTML;

    expect(raw).not.toContain("<");
    expect(raw).toContain("\\u003c");
    // Escaping must not corrupt the document: the payload survives as data.
    expect(JSON.parse(raw).name).toBe('</script><img src=x onerror="alert(1)">');
  });

  it("does not create a second element from an injected tag", () => {
    const { container } = render(
      <JsonLd data={{ "@type": "WebPage", name: "</script><script>x</script>" }} />,
    );

    expect(container.querySelectorAll("script")).toHaveLength(1);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
