/**
 * Public surface of the job-match feature.
 *
 * One component and the shapes around it. The scorer, the resume index, and the keyword
 * matcher stay internal on purpose: they are only meaningful together, and exporting
 * `scoreJobMatch` would invite a second caller to score against a hand-built index whose
 * zone weighting drifts from this one's.
 *
 * `AtsScore` and friends *are* exported, because a consumer that wants to show the
 * number somewhere else needs the type of what it is showing.
 */

export { JobMatchDialog } from "./components/job-match-dialog";
export type { JobMatchDialogProps } from "./components/job-match-dialog";

export type {
  AtsBand,
  AtsComponent,
  AtsComponentId,
  AtsScore,
  KeywordVerdict,
} from "./lib/ats-score";
export type { JobGapsStatus, JobMatchOutcome, JobMatchStatus } from "./hooks/use-job-match";
