import type { JsonLdNode } from "@/lib/seo";

/**
 * Emits a schema.org document as an inline `application/ld+json` script.
 *
 * `<` is escaped rather than serialized raw. `JSON.stringify` will happily emit
 * the literal characters `</script>` if any string in the graph contains them,
 * which closes the tag early and turns the rest of the payload into live markup —
 * a script-injection vector the moment any of this data is user-supplied (share
 * pages will pass resume titles through here).
 */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      // `dangerouslySetInnerHTML` is the only way to emit ld+json — React escapes
      // children, which would corrupt the JSON. Safe here only because of the
      // `<` substitution below.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
