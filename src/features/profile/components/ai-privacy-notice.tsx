import { ShieldCheckIcon } from "lucide-react";

import { SectionCard } from "@/components/shared";
import { describeModel } from "@/services/ai";

/**
 * Provider display names.
 *
 * Restated rather than derived: `AI_PROVIDER` is an env-level id, and shipping
 * `"google"` lowercase into a sentence about where a user's employment history is
 * sent reads as a leak of internals in exactly the place that needs to read as
 * deliberate.
 */
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google (Gemini)",
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
};

/**
 * What leaves the app when the user presses an AI button.
 *
 * On the settings page rather than buried in a policy document, because the free
 * tier runs on a provider's free quota and that is a materially different privacy
 * position from a paid endpoint — a user who is drafting with real employer names
 * deserves to know before, not after.
 *
 * Synchronous: `describeModel` reads env and formats a model id, it does not
 * instantiate a client or reach the network, so this component never suspends and
 * needs no boundary of its own.
 */
export function AiPrivacyNotice() {
  const { provider, modelId } = describeModel("quality");
  const providerName = PROVIDER_NAMES[provider] ?? provider;

  return (
    <SectionCard
      icon={ShieldCheckIcon}
      title="What gets sent to the AI"
      description={`Requests are processed by ${providerName}.`}
    >
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          Only the text an action needs is sent — the field you are editing, plus nearby context
          such as your job title or the posting you pasted. Never your email, password, or account
          details.
        </li>
        <li>
          Nothing is sent until you press an AI button. Typing, autosave, and export never reach the
          provider.
        </li>
        <li>
          A job posting you paste stays in that dialog for the sitting and is not saved to your
          resume.
        </li>
        <li>
          We record that a request happened — capability, credits, tokens, timing — so the ledger
          above can be honest. The prompt and the generated text are not stored in that record.
        </li>
        <li>
          Free-tier requests run on the provider&rsquo;s free quota, which may allow them to be used
          for improving their models. Avoid pasting anything you would not put on a resume you send
          out.
        </li>
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Current model: <span className="font-mono">{modelId}</span>
      </p>
    </SectionCard>
  );
}
