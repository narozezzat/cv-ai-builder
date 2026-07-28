/**
 * Public surface of the profile feature.
 *
 * Same contract as the auth barrel: routes and other features reach this file and
 * nothing deeper. Actions stay private — they are called by the forms exported here,
 * and a route that wants to write a profile should render the form rather than
 * inventing its own. The queries *are* exported, because a Server Component has to
 * be able to read the account row it renders.
 */

export { ActivityFeed } from "./components/activity-feed";
export { ActivityFeedSection, ActivityFeedSkeleton } from "./components/activity-feed-section";
export { AiCreditsCard, FREE_MONTHLY_AI_CREDITS } from "./components/ai-credits-card";
export { AiCreditsSection, AiCreditsSkeleton } from "./components/ai-credits-section";
export { AiPreferencesForm } from "./components/ai-preferences-form";
export { AppearanceForm } from "./components/appearance-form";
export { AvatarUploader } from "./components/avatar-uploader";
export { DashboardGreeting, DashboardGreetingSkeleton } from "./components/dashboard-greeting";
export { ProfileForm } from "./components/profile-form";
export { ThemeSync } from "./components/theme-sync";
export { UserAvatar } from "./components/user-avatar";
export { UserMenu } from "./components/user-menu";

export { getDashboardStats, getProfile, getRecentActivity } from "./queries/profile-queries";

export { parseAiPreferences, parseAppearance } from "./schema/profile-schema";

export type {
  AiPreferences,
  AppearanceInput,
  Locale,
  ProfileInfoInput,
  ThemePreference,
} from "./schema/profile-schema";
