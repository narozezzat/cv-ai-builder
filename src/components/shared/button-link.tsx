import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonLinkProps
  extends ComponentProps<typeof Link>, VariantProps<typeof buttonVariants> {}

/**
 * A link that looks like a button.
 *
 * Not `<Button render={<Link />} />`: Base UI's Button enforces native button
 * semantics (`nativeButton` defaults to `true`) and warns when the rendered
 * element is not a `<button>`. An anchor has its own role, keyboard behaviour
 * and context menu, and should keep them — so this borrows only the variant
 * classes.
 */
export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
