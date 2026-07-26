import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { avatarInitials } from "../lib/avatar";

interface UserAvatarProps {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * The account's photo, with initials behind it.
 *
 * One component so the fallback rule is decided once: a broken or missing image
 * must never collapse into an empty circle, and the initials come from the same
 * helper everywhere so the avatar in the header and the one in settings can't
 * disagree about what a user's initials are.
 *
 * Server component — nothing here is interactive. The uploader wraps it.
 */
export function UserAvatar({
  fullName,
  email,
  avatarUrl,
  size = "default",
  className,
}: UserAvatarProps) {
  const initials = avatarInitials(fullName, email);

  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={fullName ?? email ?? "Profile photo"} />
      ) : null}
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
}
