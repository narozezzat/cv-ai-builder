/**
 * Credential changes made from inside a session.
 *
 * Separate from `auth-schema.ts` because the threat model is different: those
 * schemas guard the door, these guard the locks once someone is already inside.
 * Both changes therefore require the current password, and both re-validate here
 * and again in the action.
 */

import { z } from "zod";

import { emailSchema } from "./auth-schema";
import { passwordSchema } from "./password";

/**
 * `currentPassword` has no strength rules on purpose — it is an existing secret,
 * not a new one, and applying the current policy to it would reject accounts
 * created before the policy with a message about their own password being invalid.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((values) => values.password !== values.currentPassword, {
    message: "Choose a password you have not used here before.",
    path: ["password"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  email: emailSchema,
  /**
   * An email change is an account takeover primitive: whoever controls the address
   * controls password recovery. A stolen session should not be enough.
   */
  currentPassword: z.string().min(1, "Enter your current password."),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
