/**
 * Public surface of the shared component layer.
 *
 * Feature code imports from `@/components/shared`, never from the individual
 * files — that keeps this barrel the single place to see what is shared, and
 * lets a component be split or renamed without touching call sites.
 */

export { AsyncBoundary } from "./async-boundary";
export { GitHubIcon, GoogleIcon, XIcon } from "./brand-icons";
export { ButtonLink } from "./button-link";
export { CommandPaletteTrigger } from "./command-palette-trigger";
export { ConfirmDialog } from "./confirm-dialog";
export { EmptyState } from "./empty-state";
export { ErrorBoundary, ErrorFallback, type FallbackProps } from "./error-boundary";
export { IconButton } from "./icon-button";
export { JsonLd } from "./json-ld";
export { Logo, LogoMark } from "./logo";
export {
  LoadingOverlay,
  LoadingScreen,
  ShimmerSkeleton,
  SkeletonCard,
  SkeletonGrid,
  SkeletonText,
  Spinner,
} from "./loading";
export {
  AnimatedNumber,
  FadeIn,
  FadeUp,
  ScaleIn,
  Stagger,
  StaggerItem,
  type RevealProps,
  type StaggerProps,
} from "./motion";
export { PageHeader } from "./page-header";
export { SectionCard } from "./section-card";
export { StatusPage } from "./status-page";
export { ThemeSelect, ThemeToggle } from "./theme-toggle";
