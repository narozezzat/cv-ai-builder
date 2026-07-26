import { LogOutIcon, SettingsIcon, SparklesIcon, SwatchBookIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth";
import { routes } from "@/lib/routes";

import { UserAvatar } from "./user-avatar";

interface UserMenuProps {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * The account menu in the app header.
 *
 * A server component even though the menu itself is interactive: the primitives are
 * the client boundary, and everything this file adds — the links, the identity
 * header, the sign-out form — is markup. That matters for sign-out specifically,
 * which stays a real form posting to a Server Action rather than a click handler.
 *
 * Shows the email under the name because a user with two accounts (personal and
 * work) has no other way to tell from the header which one they are signed in as.
 */
export function UserMenu({ fullName, email, avatarUrl }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />
        }
      >
        <UserAvatar size="sm" fullName={fullName} email={email} avatarUrl={avatarUrl} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        {/*
          Not a `DropdownMenuLabel`: that is styled as a group heading, and this is
          the identity block. `aria-hidden` is deliberate — the trigger already
          announces "Account menu", and a screen-reader user arrowing into the menu
          wants the actions, not two lines of static text first.
        */}
        <div aria-hidden className="px-1.5 py-1">
          <p className="truncate text-sm font-medium">{fullName?.trim() || "Your account"}</p>
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={routes.settings} />}>
            <UserIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={routes.settingsAppearance} />}>
            <SwatchBookIcon />
            Appearance
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={routes.settingsAi} />}>
            <SparklesIcon />
            AI preferences
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={routes.settingsAccount} />}>
            <SettingsIcon />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/*
          Sign-out is a state change, so it posts. The `<form>` sits inside the
          popup — and therefore inside the portal — so the submit button and its
          form end up in the same DOM tree; a form left behind in the trigger's
          tree would never receive the click. `role="none"` keeps the popup's
          `role="menu"` owning only menu items, with the form element transparent
          to assistive technology.
        */}
        <form action={signOutAction} role="none">
          <DropdownMenuItem
            variant="destructive"
            // Menu items render a `<div>` by default, so the primitive has to be
            // told this one really is a button or it re-adds the role and key
            // handling the native element already provides.
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
