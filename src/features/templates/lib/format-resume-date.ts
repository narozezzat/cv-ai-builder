/**
 * Resume dates are partial by design, so they are formatted by hand.
 *
 * `RESUME_DATE_PATTERN` accepts `""`, `2021`, `2021-03`, and `2021-03-04`, because a
 * person remembers the year they graduated and rarely the day. Passing any of those to
 * `new Date()` would be wrong twice: `new Date("2021-03")` is parsed as UTC midnight and
 * prints as February in the Americas, and a year-only value would print as "1 Jan 2021",
 * inventing a precision the user never gave.
 *
 * So: no `Date`, no `Intl.DateTimeFormat`, no timezone. Split the string, look up the
 * month, and never show the day — a resume that says "Mar 2021 – Nov 2023" is what every
 * recruiter expects, and the day is noise on all eleven date fields in the schema.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** En dash with hairline spaces around it — the typographic form for a range. */
const RANGE_SEPARATOR = " – ";

export const PRESENT_LABEL = "Present";

/**
 * `""` for anything unparseable, so a malformed stored value renders as absent rather
 * than as "NaN undefined". The template checks for the empty string anyway, since an
 * unfilled date field is the common case.
 */
export function formatResumeDate(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const [year, month] = trimmed.split("-");

  if (!/^\d{4}$/.test(year)) {
    return "";
  }

  if (month === undefined) {
    return year;
  }

  const index = Number(month) - 1;

  return MONTHS[index] ? `${MONTHS[index]} ${year}` : year;
}

export interface ResumeDateRange {
  startDate: string;
  endDate: string;
  /** Overrides `endDate`: an ongoing role reads "Present" even if an end date lingers. */
  current?: boolean;
}

/**
 * The four shapes a range can take, in the order they are decided:
 *
 * - both ends → `Mar 2021 – Nov 2023`
 * - start, still there → `Mar 2021 – Present`
 * - one end only → that end alone; `Present` on its own says nothing useful
 * - neither → `""`
 */
export function formatResumeDateRange({ startDate, endDate, current }: ResumeDateRange): string {
  const start = formatResumeDate(startDate);
  const end = current ? PRESENT_LABEL : formatResumeDate(endDate);

  if (start && end) {
    return `${start}${RANGE_SEPARATOR}${end}`;
  }

  if (start) {
    return start;
  }

  return current ? "" : end;
}
