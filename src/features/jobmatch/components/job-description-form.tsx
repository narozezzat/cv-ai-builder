"use client";

/**
 * Paste the posting.
 *
 * One field, so no React Hook Form: a controlled textarea plus a `safeParse` on submit
 * covers the boundary the rules ask about, and the form layer's DOM-value adoption
 * exists for password managers filling inputs we never see — irrelevant to a textarea
 * the user pastes into by hand.
 *
 * The counter appears only near the cap. A live count on an empty field reads as a
 * quota to fill, and the minimum is stated in the hint above instead.
 */

import { Sparkles } from "lucide-react";
import { useId, useState } from "react";

import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  JOB_DESCRIPTION_MAX,
  JOB_DESCRIPTION_MIN,
  jobDescriptionSchema,
} from "../schema/job-match-schema";

/** Where the counter starts mattering: the last tenth of the allowance. */
const COUNTER_THRESHOLD = JOB_DESCRIPTION_MAX * 0.9;

export interface JobDescriptionFormProps {
  pending: boolean;
  onSubmit: (jobDescription: string) => void;
}

export function JobDescriptionForm({ pending, onSubmit }: JobDescriptionFormProps) {
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const parsed = jobDescriptionSchema.safeParse({ jobDescription: value });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Paste the job posting to continue.");
      return;
    }

    setError(null);
    onSubmit(parsed.data.jobDescription);
  }

  return (
    <form className="space-y-3 p-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">
          Job description
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          Paste the requirements and responsibilities — at least {JOB_DESCRIPTION_MIN} characters.
          Your resume is scored against them here, in your browser.
        </p>
        <Textarea
          id={fieldId}
          value={value}
          rows={10}
          // Not `maxLength`: silently truncating a paste loses requirements the user
          // believes were scored. The schema rejects it with a reason instead.
          spellCheck={false}
          placeholder="Senior Frontend Engineer&#10;&#10;Requirements&#10;• 5+ years building production React applications&#10;• Strong TypeScript…"
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          className="max-h-64 min-h-40 text-sm"
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {value.length > COUNTER_THRESHOLD
            ? `${value.length.toLocaleString()} / ${JOB_DESCRIPTION_MAX.toLocaleString()} characters`
            : "Costs 1 AI credit."}
        </p>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Spinner size="sm" className="size-3.5" />
          ) : (
            <Sparkles aria-hidden className="size-3.5" />
          )}
          {pending ? "Matching…" : "Match my resume"}
        </Button>
      </div>
    </form>
  );
}
