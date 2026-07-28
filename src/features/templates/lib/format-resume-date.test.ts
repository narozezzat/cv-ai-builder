/**
 * These assertions are the reason `formatResumeDate` avoids `Date` entirely: the
 * timezone cases below (`"2021-03"` must never print as February) are exactly what a
 * `new Date(value)` implementation gets wrong west of UTC, and a test that only ran in
 * UTC would never catch it.
 */

import { describe, expect, it } from "vitest";

import { PRESENT_LABEL, formatResumeDate, formatResumeDateRange } from "./format-resume-date";

describe("formatResumeDate", () => {
  it("returns an empty string for an absent date", () => {
    expect(formatResumeDate("")).toBe("");
    expect(formatResumeDate("   ")).toBe("");
  });

  it("keeps a year-only value at year precision", () => {
    expect(formatResumeDate("2021")).toBe("2021");
  });

  it("names the month without shifting it across a timezone", () => {
    expect(formatResumeDate("2021-01")).toBe("Jan 2021");
    expect(formatResumeDate("2021-03")).toBe("Mar 2021");
    expect(formatResumeDate("2021-12")).toBe("Dec 2021");
  });

  it("never shows the day, even when one is stored", () => {
    expect(formatResumeDate("2021-03-04")).toBe("Mar 2021");
  });

  it("falls back to the year when the month is out of range", () => {
    expect(formatResumeDate("2021-00")).toBe("2021");
    expect(formatResumeDate("2021-13")).toBe("2021");
  });

  it("returns an empty string for anything unparseable", () => {
    expect(formatResumeDate("last summer")).toBe("");
    expect(formatResumeDate("21-03")).toBe("");
    expect(formatResumeDate("02021-03")).toBe("");
  });
});

describe("formatResumeDateRange", () => {
  it("joins both ends with an en dash", () => {
    expect(formatResumeDateRange({ startDate: "2021-03", endDate: "2023-11" })).toBe(
      "Mar 2021 – Nov 2023",
    );
  });

  it("reads Present for an ongoing role", () => {
    expect(formatResumeDateRange({ startDate: "2021-03", endDate: "", current: true })).toBe(
      `Mar 2021 – ${PRESENT_LABEL}`,
    );
  });

  it("lets `current` override a lingering end date", () => {
    expect(formatResumeDateRange({ startDate: "2021-03", endDate: "2023-11", current: true })).toBe(
      `Mar 2021 – ${PRESENT_LABEL}`,
    );
  });

  it("shows a single end on its own", () => {
    expect(formatResumeDateRange({ startDate: "2021", endDate: "" })).toBe("2021");
    expect(formatResumeDateRange({ startDate: "", endDate: "2023-11" })).toBe("Nov 2023");
  });

  it("says nothing when there is nothing to say", () => {
    expect(formatResumeDateRange({ startDate: "", endDate: "" })).toBe("");
    // "Present" with no start date is a claim about a job that never began.
    expect(formatResumeDateRange({ startDate: "", endDate: "", current: true })).toBe("");
  });
});
