"use client";

import { AlertCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type PathValue,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Thin form layer over React Hook Form. shadcn v4 ships no `form` primitive, so
 * this owns the part that is easy to get wrong and tedious to repeat: wiring
 * `id`, `aria-describedby`, and `aria-invalid` between a label, a control, its
 * description, and its error message.
 *
 * Every form in the app goes through `<Form>` + `<FormField>`, which means the
 * accessibility contract is satisfied structurally rather than remembered.
 */

/* -------------------------------------------------------------------------- */
/*  Field context                                                             */
/* -------------------------------------------------------------------------- */

interface FieldContextValue {
  name: string;
  controlId: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  hasDescription: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldContext(component: string): FieldContextValue {
  const context = useContext(FieldContext);

  if (!context) {
    throw new Error(`<${component}> must be rendered inside a <FormField>.`);
  }

  return context;
}

/* -------------------------------------------------------------------------- */
/*  Form                                                                      */
/* -------------------------------------------------------------------------- */

interface FormProps<TFieldValues extends FieldValues> extends Omit<
  ComponentProps<"form">,
  "onSubmit"
> {
  form: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
}

/**
 * Renders a `<form>` and provides the RHF context. `noValidate` is deliberate:
 * Zod owns validation, and native browser bubbles would compete with our own
 * error messages.
 */
export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  className,
  children,
  ...props
}: FormProps<TFieldValues>) {
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Copies values the DOM has and React Hook Form does not into form state.
   *
   * Two ways a field ends up filled on screen and empty in state, both of which
   * produced a sign-in form that insisted "Enter your password" over a field full
   * of dots:
   *
   * 1. **Password managers and browser autofill.** Chrome's own autofill dispatches
   *    an `input` event, but extensions frequently set `.value` directly, and a
   *    direct assignment fires nothing — React never learns about it.
   * 2. **Typing before hydration.** The markup is interactive as soon as it paints;
   *    RHF's state does not exist until the bundle runs. Anything typed in between
   *    lives only in the DOM.
   *
   * Run on mount and again immediately before every submit, because autofill can
   * land at any point after load and there is no event to hook. Only ever fills a
   * field state considers empty, so it cannot overwrite what the user typed.
   */
  const adoptDomValues = useCallback(() => {
    const element = formRef.current;

    if (!element) return;

    for (const control of Array.from(element.elements)) {
      const isTextual =
        control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement;

      if (!isTextual || !control.name || control.value === "") continue;
      // Checkboxes, radios, and file inputs carry their state somewhere other than
      // `.value`, and none of them is autofillable this way.
      if (
        control instanceof HTMLInputElement &&
        ["checkbox", "radio", "file"].includes(control.type)
      )
        continue;

      const name = control.name as FieldPath<TFieldValues>;
      const known = form.getValues(name);

      if (known === "" || known === undefined || known === null) {
        form.setValue(name, control.value as PathValue<TFieldValues, FieldPath<TFieldValues>>, {
          shouldDirty: true,
        });
      }
    }
  }, [form]);

  useEffect(() => {
    adoptDomValues();
  }, [adoptDomValues]);

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        noValidate
        /*
         * Security control, not a formality. Submission is handled by `onSubmit`,
         * which only exists once React has hydrated — and a form submitted before
         * that falls back to the browser's default method. That default is GET,
         * which serialises every field into the query string: on the sign-in form
         * that puts the password in the address bar, the browser history, the
         * server's access log, and the `Referer` sent to the next origin.
         *
         * `post` makes the pre-hydration submit a dead end (no route handler
         * answers it) instead of a leak. Placed before the spread so a caller can
         * still override it deliberately.
         */
        method="post"
        onSubmit={(event) => {
          // Before validation, not after: an autofilled password that state never
          // saw would otherwise fail `min(1)` and the user would be told to enter
          // what they can plainly see is already there.
          adoptDomValues();

          return form.handleSubmit(onSubmit)(event);
        }}
        className={cn("space-y-5", className)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormField                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Props handed to the render callback. Spread onto the control:
 * `<Input {...field} />`.
 *
 * `ref` is included so RHF can focus the offending control on a failed submit.
 */
type RenderField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  ControllerRenderProps<TFieldValues, TName>,
  "ref"
> & {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean;
  ref: ControllerRenderProps<TFieldValues, TName>["ref"];
};

interface FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  name: TName;
  label?: ReactNode;
  /** Helper text. Rendered above the error so the two never collide. */
  description?: ReactNode;
  /** Adds the required marker and its screen-reader text. Zod still enforces it. */
  required?: boolean;
  className?: string;
  /** Hide the label visually but keep it for assistive tech (search inputs). */
  hideLabel?: boolean;
  children: (field: RenderField<TFieldValues, TName>) => ReactNode;
}

/**
 * One labelled, described, error-reporting field.
 *
 * @example
 * <FormField name="email" label="Email" description="We never share it.">
 *   {(field) => <Input type="email" autoComplete="email" {...field} />}
 * </FormField>
 */
export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  label,
  description,
  required,
  className,
  hideLabel = false,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const { control } = useFormContext<TFieldValues>();
  const reactId = useId();

  const controlId = `${reactId}-control`;
  const descriptionId = `${reactId}-description`;
  const errorId = `${reactId}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = Boolean(fieldState.error);
        const describedBy =
          [description ? descriptionId : null, invalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <FieldContext.Provider
            value={{
              name,
              controlId,
              descriptionId,
              errorId,
              invalid,
              hasDescription: Boolean(description),
            }}
          >
            <div className={cn("space-y-2", className)}>
              {label ? (
                <Label htmlFor={controlId} className={hideLabel ? "sr-only" : undefined}>
                  {label}
                  {required ? (
                    <>
                      <span aria-hidden className="text-destructive">
                        *
                      </span>
                      <span className="sr-only">(required)</span>
                    </>
                  ) : null}
                </Label>
              ) : null}

              {children({
                ...field,
                id: controlId,
                "aria-describedby": describedBy,
                "aria-invalid": invalid,
              })}

              {description ? (
                <p id={descriptionId} className="text-xs text-muted-foreground">
                  {description}
                </p>
              ) : null}

              {invalid ? (
                <p id={errorId} className="text-xs font-medium text-destructive">
                  {fieldState.error?.message}
                </p>
              ) : null}
            </div>
          </FieldContext.Provider>
        );
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Form-level error                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Displays the `root` error. Server actions report failures that belong to no
 * single field ("Invalid credentials", "Rate limit exceeded") via
 * `form.setError("root", { message })`, and this is where they surface.
 *
 * `role="alert"` so the message is announced the moment it appears — a failed
 * login that only changes pixels is invisible to a screen reader user.
 */
export function FormError({ className }: { className?: string }) {
  const { errors } = useFormState();
  const message = errors.root?.message;

  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle aria-hidden className="mt-px size-4 shrink-0" />
      <span className="text-pretty">{message}</span>
    </div>
  );
}

/**
 * Escape hatch for controls that can't take spread props (a custom editor, a
 * third-party widget) but still need the field's generated ids.
 */
export function useFormFieldIds() {
  return useFieldContext("useFormFieldIds");
}
