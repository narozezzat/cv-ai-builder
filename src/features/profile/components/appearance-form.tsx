"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ThemeSelect } from "@/components/shared";
import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateAppearanceAction } from "../actions/profile-actions";
import {
  appearanceSchema,
  LOCALE_LABELS,
  LOCALES,
  THEME_PREFERENCES,
  type AppearanceInput,
  type Locale,
  type ThemePreference,
} from "../schema/profile-schema";

function isThemePreference(value: string | undefined): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/**
 * Theme and language.
 *
 * The theme is a special case: `next-themes` owns what the page is currently
 * painted as, and it applies a change instantly. This form's `theme` field mirrors
 * that choice so Save can persist it — repainting only after a server round-trip
 * would make the control feel broken, and a failed save must not leave the user
 * looking at a theme they didn't pick.
 *
 * Carrying the saved preference *to* a new browser is `ThemeSync`'s job, not this
 * form's; a settings page the user may never open is the wrong place for it.
 */
export function AppearanceForm({ defaultValues }: { defaultValues: AppearanceInput }) {
  // Read only. `ThemeSelect` is what writes — see the note on the control below.
  const { theme } = useTheme();

  const form = useForm<AppearanceInput>({
    resolver: zodResolver(appearanceSchema),
    defaultValues,
    mode: "onBlur",
  });

  // On first paint `next-themes` has not read localStorage yet, so `theme` is
  // undefined and the stored preference stands. Once it resolves — including when
  // the user flips the toggle in the app header — the field follows it.
  useEffect(() => {
    if (!isThemePreference(theme)) return;

    if (form.getValues("theme") !== theme) {
      form.setValue("theme", theme, { shouldDirty: true });
    }
  }, [form, theme]);

  return (
    <Form
      form={form}
      className="space-y-5"
      onSubmit={(values) =>
        runAction(
          form,
          () => updateAppearanceAction(values),
          (result) => {
            form.reset(values);
            toast.success(result.message ?? "Appearance saved.");
          },
        )
      }
    >
      {/*
        Not a `FormField`: `ThemeSelect` is driven by `next-themes`, not by the
        form, and giving it a second source of truth is how the two get out of
        step. The field is kept in sync by the effect above.
      */}
      <div className="space-y-2">
        {/*
          A plain paragraph, not a `<Label>`: there is no single control to point
          `htmlFor` at — `ThemeSelect` is a toggle group of three buttons, and it
          carries its own `aria-label="Theme"`.
        */}
        <p className="text-sm font-medium">Theme</p>
        <ThemeSelect />
        <p className="text-xs text-muted-foreground">
          Applies immediately. Save to use it on your other devices too.
        </p>
      </div>

      <FormField<AppearanceInput, "locale">
        name="locale"
        label="Language"
        description="Arabic renders the interface right-to-left."
      >
        {({ value, onChange, onBlur, name, id, ...aria }) => (
          <Select name={name} value={value} onValueChange={(next) => onChange(next as Locale)}>
            <SelectTrigger id={id} onBlur={onBlur} className="w-full sm:w-60" {...aria}>
              <SelectValue>{(selected: Locale) => LOCALE_LABELS[selected]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormError />

      <SubmitButton pendingLabel="Saving…" disabled={!form.formState.isDirty}>
        Save preferences
      </SubmitButton>
    </Form>
  );
}
