"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useController, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Form, FormError, runAction, SubmitButton } from "@/components/shared/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { updateAiPreferencesAction } from "../actions/profile-actions";
import {
  AI_SPELLING,
  AI_SPELLING_LABELS,
  AI_TONE_LABELS,
  AI_TONES,
  AI_VERBOSITY,
  AI_VERBOSITY_LABELS,
  aiPreferencesFormSchema,
  type AiPreferences,
} from "../schema/profile-schema";

/** The keys of `AiPreferences` — all three are flat string unions. */
type PreferenceName = keyof AiPreferences;

interface ChoiceFieldProps<TName extends PreferenceName> {
  name: TName;
  legend: string;
  description: string;
  options: readonly AiPreferences[TName][];
  labels: Record<AiPreferences[TName], string>;
}

/**
 * One radio group per preference.
 *
 * Not built on `FormField`: that component pairs a `<Label htmlFor>` with a single
 * control, and a radio group has no single control to point at. The correct
 * grouping semantics here are `<fieldset>` + `<legend>`, with each option's own
 * `<Label>` bound to its radio — which works because Base UI renders a radio as a
 * `<button>`, and a button is labelable.
 *
 * Radios rather than a select for all three: every option is one or two words, and
 * a preference the user sets once is better shown in full than hidden behind a
 * dropdown they have to open to learn what the choices are.
 */
function ChoiceField<TName extends PreferenceName>({
  name,
  legend,
  description,
  options,
  labels,
}: ChoiceFieldProps<TName>) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const { field } = useController<AiPreferences, TName>({ name });

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </p>

      <RadioGroup
        name={field.name}
        value={field.value}
        onValueChange={(next) => field.onChange(next as AiPreferences[TName])}
        aria-describedby={descriptionId}
        className="pt-1"
      >
        {options.map((option) => {
          const optionId = `${id}-${option}`;

          return (
            <div key={option} className="flex items-center gap-2.5">
              <RadioGroupItem id={optionId} value={option} onBlur={field.onBlur} />
              <Label htmlFor={optionId} className="font-normal">
                {labels[option]}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

/**
 * How the AI writes for this user.
 *
 * These are hints, not guarantees — they are folded into the system prompt of every
 * generation, so the model treats them as instructions and not as constraints the
 * app enforces. Setting them here rather than per-request keeps sixteen AI actions
 * from each needing their own tone picker.
 */
export function AiPreferencesForm({ defaultValues }: { defaultValues: AiPreferences }) {
  const form = useForm<AiPreferences>({
    resolver: zodResolver(aiPreferencesFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  return (
    <Form
      form={form}
      className="space-y-6"
      onSubmit={(values) =>
        runAction(
          form,
          () => updateAiPreferencesAction(values),
          (result) => {
            form.reset(values);
            toast.success(result.message ?? "AI preferences saved.");
          },
        )
      }
    >
      <ChoiceField
        name="tone"
        legend="Tone"
        description="How generated summaries and bullet points read."
        options={AI_TONES}
        labels={AI_TONE_LABELS}
      />

      <ChoiceField
        name="verbosity"
        legend="Length"
        description="Concise favours short, scannable lines. Detailed adds context and metrics."
        options={AI_VERBOSITY}
        labels={AI_VERBOSITY_LABELS}
      />

      <ChoiceField
        name="spelling"
        legend="Spelling"
        description="Applied to every generated line, so one resume never mixes both."
        options={AI_SPELLING}
        labels={AI_SPELLING_LABELS}
      />

      <FormError />

      <SubmitButton pendingLabel="Saving…" disabled={!form.formState.isDirty}>
        Save preferences
      </SubmitButton>
    </Form>
  );
}
