/**
 * Validation contracts for every auth form.
 *
 * SECURITY: these schemas run twice — once in the browser for feedback, and again
 * inside the server action, which is the only run that counts. A server action is
 * a public HTTP endpoint; the form is just the friendliest client of it, and
 * nothing prevents a hand-rolled request with arbitrary fields. Every action
 * below therefore re-parses its input rather than trusting the shape it was
 * given.
 */

import { z } from "zod";

import { passwordSchema } from "./password";

/**
 * Lower-cased and trimmed before validation, not after, so a pasted address with
 * a stray space passes instead of failing on something invisible. Normalizing the
 * case also keeps the rate-limit subject stable — `A@b.com` and `a@b.com` are one
 * account to GoTrue and must be one bucket to the limiter.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(80, "That name is too long.");

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  /**
   * `boolean` refined to true rather than `literal(true)`: the literal narrows the
   * inferred type to `true`, which makes an unchecked default un-typeable in React
   * Hook Form's `defaultValues`.
   */
  acceptTerms: z.boolean().refine((accepted) => accepted, "Accept the terms to continue."),
});

/**
 * No password rules on sign-in. Applying them here would reject a legitimate
 * password set before the rules tightened, and it leaks the policy to anyone
 * probing the endpoint.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords do not match.",
  });

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const OAUTH_PROVIDERS = ["google", "github"] as const;

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
