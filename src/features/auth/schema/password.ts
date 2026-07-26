/**
 * Password rules, stated once.
 *
 * Three consumers have to agree or the user gets a confusing experience: the Zod
 * schema that blocks submission, the strength meter that renders live feedback,
 * and GoTrue itself. The first two are derived from `PASSWORD_RULES` below, and
 * the third is configured in `supabase/config.toml` — `minimum_password_length =
 * 10` and `password_requirements = "lower_upper_letters_digits"`. Changing a rule
 * here means changing it there too, otherwise a password the form accepts comes
 * back as a 422 the user cannot act on.
 */

import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;

/**
 * bcrypt hashes at most 72 bytes and silently ignores the rest, so a longer
 * password is not more secure — it is a password whose tail does nothing. Bytes,
 * not characters: an emoji passphrase hits the ceiling four times sooner than its
 * length suggests.
 */
export const PASSWORD_MAX_BYTES = 72;

/** Length at which the meter awards its last point. Not a requirement. */
const PASSWORD_STRONG_LENGTH = 16;

const hasMinLength = (value: string) => value.length >= PASSWORD_MIN_LENGTH;
const hasMixedCase = (value: string) => /\p{Ll}/u.test(value) && /\p{Lu}/u.test(value);
const hasDigit = (value: string) => /\p{Nd}/u.test(value);
const withinByteLimit = (value: string) =>
  new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES;

export type PasswordRule = {
  id: string;
  /** Shown in the checklist under the field, so it reads as an instruction. */
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: hasMinLength },
  { id: "case", label: "Upper and lowercase letters", test: hasMixedCase },
  { id: "digit", label: "At least one number", test: hasDigit },
];

/**
 * Ordering matters. `min(1)` comes first so an untouched field reports "Enter a
 * password" rather than three simultaneous complaints about a string that does
 * not exist yet — React Hook Form surfaces the first issue.
 */
export const passwordSchema = z
  .string()
  .min(1, "Enter a password.")
  .refine(hasMinLength, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine(withinByteLimit, `Keep it under ${PASSWORD_MAX_BYTES} bytes.`)
  .refine(hasMixedCase, "Mix uppercase and lowercase letters.")
  .refine(hasDigit, "Include at least one number.");

export type PasswordStrength = {
  /** 0–4. 0 means empty, 3 means every rule satisfied, 4 adds a length bonus. */
  score: number;
  label: string;
  /** Rule ids currently satisfied, for the checklist. */
  satisfied: readonly string[];
};

/**
 * Scores a password for the meter.
 *
 * Deliberately a rule count plus a length bonus rather than an entropy estimate:
 * the number the user sees has to be the same thing the form enforces, or the
 * meter says "strong" about a password the schema rejects. Length earns the
 * fourth point because length is what actually resists offline cracking once the
 * character classes are covered.
 */
export function scorePassword(value: string): PasswordStrength {
  if (!value) {
    return { score: 0, label: "", satisfied: [] };
  }

  const satisfied = PASSWORD_RULES.filter((rule) => rule.test(value)).map((rule) => rule.id);
  const bonus =
    satisfied.length === PASSWORD_RULES.length && value.length >= PASSWORD_STRONG_LENGTH;
  const score = Math.min(satisfied.length + (bonus ? 1 : 0), 4);

  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;

  return { score, label: labels[score] ?? labels[0], satisfied };
}
