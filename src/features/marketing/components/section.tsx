import { FadeUp } from "@/components/shared";
import { cn } from "@/lib/utils";

/**
 * Vertical rhythm and heading treatment for every landing section.
 *
 * Sections differ in content, not in structure — pulling the eyebrow/title/lede
 * stack here keeps the type scale and spacing identical down the page, which is
 * most of what makes a marketing page read as designed rather than assembled.
 */

// `title` is omitted from the DOM props: on an element it is the tooltip
// attribute and must be a string, which would forbid passing a node with a
// highlighted span in it — which is exactly what the headings do.
interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Anchor target. Also what the header nav links point at. */
  id?: string;
  /** Small uppercase kicker above the title. */
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Left-aligns the heading block instead of centring it. */
  align?: "center" | "start";
  /** Applied to the inner max-width wrapper, not the section. */
  containerClassName?: string;
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  align = "center",
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  const centered = align === "center";

  return (
    <section
      id={id}
      // `scroll-mt` offsets the sticky header, otherwise an anchor jump parks the
      // section title underneath it.
      className={cn("scroll-mt-24 py-20 sm:py-28", className)}
      {...props}
    >
      <div className={cn("mx-auto w-full max-w-6xl px-6", containerClassName)}>
        {(eyebrow ?? title ?? description) ? (
          <FadeUp
            whenInView
            className={cn("mb-14 flex flex-col gap-4", centered && "items-center text-center")}
          >
            {eyebrow ? (
              <span className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2 className="max-w-3xl text-3xl font-semibold sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {description}
              </p>
            ) : null}
          </FadeUp>
        ) : null}
        {children}
      </div>
    </section>
  );
}
