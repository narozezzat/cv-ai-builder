"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, LayoutDashboardIcon, FileTextIcon, LayoutTemplateIcon } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CommandPaletteTrigger, Logo, ThemeToggle } from "@/components/shared";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  userMenu?: React.ReactNode;
}

const ITEMS = [
  { href: routes.dashboard, label: "Overview", icon: LayoutDashboardIcon },
  { href: routes.resumes, label: "Resumes", icon: FileTextIcon },
  { href: routes.templateGallery, label: "Templates", icon: LayoutTemplateIcon },
] as const;

export function MobileNav({ userMenu }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="size-9 rounded-lg border-border/60 bg-background/50 backdrop-blur-xs"
            aria-label="Open navigation menu"
          />
        }
      >
        <MenuIcon className="size-4.5 text-foreground" />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[85vw] max-w-xs flex-col justify-between p-0">
        <div>
          <SheetHeader className="border-b border-border/50 p-4">
            <div className="flex items-center justify-between">
              <Logo href={routes.dashboard} />
            </div>
          </SheetHeader>

          <div className="space-y-6 p-4">
            <nav aria-label="Mobile app sections" className="space-y-1">
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">
                Navigation
              </p>
              {ITEMS.map((item) => {
                const active =
                  item.href === routes.dashboard
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 font-semibold text-brand"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">
                Search
              </p>
              <div className="px-1">
                <CommandPaletteTrigger className="w-full justify-start text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Account & Theme controls */}
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/20 p-4">
          {userMenu}
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}
