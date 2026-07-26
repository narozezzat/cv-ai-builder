/**
 * Third-party brand marks.
 *
 * lucide-react v1 dropped its brand icons — trademark reasons — so `Github` and
 * `Twitter` no longer exist as imports. These are the official paths, drawn at
 * 24×24 with `currentColor` so they inherit sizing and colour from the same
 * `size-4` / `text-muted-foreground` classes as every lucide icon beside them.
 *
 * `aria-hidden` is set here rather than left to callers: these only ever appear
 * inside a labelled link or button, so announcing them twice is the failure mode.
 */

type BrandIconProps = React.ComponentProps<"svg">;

export function GitHubIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.02 3.29 9.28 7.86 10.75.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.09 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55 4.56-1.48 7.85-5.73 7.85-10.75C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

/**
 * The one mark that must not inherit `currentColor`.
 *
 * Google's brand guidelines require the four-colour "G" on the sign-in button, so
 * each path carries its own fill and the icon looks identical in light and dark
 * mode. Do not add `fill="currentColor"` to the root here — a monochrome Google
 * logo is a guideline violation, and it also stops reading as "Google" at 16px.
 */
export function GoogleIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44a5.51 5.51 0 0 1-2.39 3.62v3.01h3.86c2.26-2.08 3.61-5.15 3.61-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.86-3.01c-1.08.72-2.45 1.15-4.09 1.15-3.14 0-5.8-2.12-6.75-4.97H1.27v3.12A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.26a7.2 7.2 0 0 1 0-4.52V6.62H1.27a12 12 0 0 0 0 10.76l3.98-3.12Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l3.98 3.12C6.2 6.89 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function XIcon(props: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
