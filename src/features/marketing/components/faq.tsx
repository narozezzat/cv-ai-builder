import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { FAQS } from "../content";
import { Section } from "./section";

/**
 * The answers here are also emitted as `FAQPage` structured data by the page, so
 * both come from `FAQS` — a divergence between the visible answer and the one in
 * the JSON-LD is exactly the kind of thing Google flags as cloaking.
 */
export function Faq() {
  return (
    <Section
      id="faq"
      eyebrow="Questions"
      title="The things people ask first"
      containerClassName="max-w-3xl"
    >
      <Accordion className="w-full">
        {FAQS.map((item) => (
          <AccordionItem key={item.question} value={item.question}>
            {/* Roomier than the primitive's default: this is a reading surface,
                not a dense settings panel. */}
            <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="max-w-prose pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
