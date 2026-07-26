import { AlertCircle, MailCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { callbackErrorMessage } from "../lib/auth-errors";

/**
 * Banner above an auth form, for state that arrived in the URL rather than from a
 * submission — a callback failure, or the confirmation after a redirect.
 *
 * Server Components, both of them: the state is in the query string, so there is
 * nothing to hydrate and no reason to ship JavaScript for a paragraph.
 */
export function AuthNotice({
  tone,
  title,
  children,
}: {
  tone: "success" | "error";
  title: string;
  children?: ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : MailCheck;

  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} className="mb-6">
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}

/**
 * Renders a failed auth callback.
 *
 * SECURITY: takes the provider's `error_code`, not a message. The callback route
 * could have URL-encoded a human-readable string and saved this mapping, but that
 * would let anyone put arbitrary text on our own login page — "Your account was
 * closed, email support at <attacker address>" is a convincing phish precisely
 * because the domain and the padlock are genuine. Codes are looked up in a table we
 * control and anything unrecognized becomes the generic message.
 */
export function AuthErrorAlert({ code }: { code?: string }) {
  if (!code) {
    return null;
  }

  return (
    <AuthNotice tone="error" title="Sign-in could not be completed">
      {callbackErrorMessage(code)}
    </AuthNotice>
  );
}
