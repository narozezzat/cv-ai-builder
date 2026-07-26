import { describe, expect, it } from "vitest";

import {
  breadcrumbSchema,
  faqSchema,
  jsonLdGraph,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";
import { SITE_URL, absoluteUrl } from "@/lib/site";

describe("absoluteUrl", () => {
  it("prefixes the origin and tolerates a missing leading slash", () => {
    expect(absoluteUrl("/templates")).toBe(`${SITE_URL}/templates`);
    expect(absoluteUrl("templates")).toBe(`${SITE_URL}/templates`);
  });

  it("never doubles the slash at the root", () => {
    expect(absoluteUrl()).toBe(`${SITE_URL}/`);
    expect(absoluteUrl("/")).toBe(`${SITE_URL}/`);
  });
});

describe("schema graph", () => {
  it("wraps nodes in a single @context/@graph document", () => {
    const graph = jsonLdGraph(organizationSchema(), websiteSchema());

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toHaveLength(2);
  });

  it("cross-references the organization by @id rather than inlining it", () => {
    // This is the whole point of the `@id` values: if a node ever inlined the
    // organization block instead, the graph would carry two definitions that
    // could disagree.
    const organization = organizationSchema();
    const website = websiteSchema();
    const app = softwareApplicationSchema();

    expect(organization["@id"]).toBe(absoluteUrl("/#organization"));
    expect(website.publisher).toEqual({ "@id": organization["@id"] });
    expect(app.publisher).toEqual({ "@id": organization["@id"] });
  });
});

describe("faqSchema", () => {
  it("maps every question to a Question node with its own answer", () => {
    const items = [
      { question: "Is it ATS-safe?", answer: "Yes — exports are real text." },
      { question: "Is export free?", answer: "PDF export is free." },
    ];

    const schema = faqSchema(items);

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toEqual([
      {
        "@type": "Question",
        name: items[0].question,
        acceptedAnswer: { "@type": "Answer", text: items[0].answer },
      },
      {
        "@type": "Question",
        name: items[1].question,
        acceptedAnswer: { "@type": "Answer", text: items[1].answer },
      },
    ]);
  });
});

describe("breadcrumbSchema", () => {
  it("numbers positions from 1 and absolutizes each path", () => {
    const schema = breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Templates", path: "/dashboard/templates" },
    ]);

    expect(schema.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "Templates",
        item: absoluteUrl("/dashboard/templates"),
      },
    ]);
  });
});
