/**
 * Turns `activity_logs.action` strings into something a person can read.
 *
 * The column is free text with a length check rather than an enum, because an
 * activity log that rejects unknown actions is an activity log that stops
 * recording exactly when a new feature ships. The cost of that choice is paid
 * here: the map covers what we write today, and anything unrecognized degrades to
 * a humanized version of the raw action instead of showing nothing.
 */

/** Actions written today, in the order they were introduced. */
const ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "auth.password_reset": "Requested a password reset",
  "auth.password_change": "Changed password",
  "auth.email_change_requested": "Requested an email change",
  "profile.update": "Updated profile",
  "profile.appearance_update": "Changed appearance settings",
  "profile.ai_preferences_update": "Changed AI preferences",
  "profile.avatar_update": "Updated profile photo",
  "profile.avatar_remove": "Removed profile photo",
};

/**
 * `resume.duplicate` → "Resume duplicate". Not elegant, but honest: it says
 * something happened and names it, which beats an empty row or a crash.
 */
function humanize(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}
