"use client";
import {savedJobAssessment} from "../../lib/job-assessment.mjs";
type ScoreReason = {score: number | null; reasoning: string};
type AssessmentMetadata = {percent?: number; assessedAt?: string; evidence?: string};
export type MatchPreview = AssessmentMetadata & ({percent: number} | {skillsExperience: ScoreReason; compensation: ScoreReason; wellbeingCulture: ScoreReason; locationWorkSetting: ScoreReason} | {factors: {label:string; value:number|null; rating:string; reason:string}[]});
export default function RoleMatchPreview({ sample, expanded = false, demo = false }: { sample?: MatchPreview; demo?: boolean; expanded?: boolean; animate?: boolean; active?: boolean }) {
  const assessment = savedJobAssessment(sample);
  const percent = assessment?.percent;
  return <section aria-label="Preference match" className="border-t border-board-line/60 pt-4">
    <div className="flex items-center gap-4">
      {typeof percent === "number" && <div className="relative grid h-16 w-16 shrink-0 place-items-center" aria-label={`${percent}% preference match`}>
        <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-board-line)" strokeWidth="6"/><circle cx="32" cy="32" r="27" fill="none" stroke="var(--color-board-accent)" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`}/></svg>
        <span aria-hidden="true" className="text-sm font-semibold tabular-nums">{percent}%</span>
      </div>}
      <div><h4 className="text-sm font-semibold">Preference match</h4><p className="mt-1 text-xs text-board-muted">{typeof percent === "number" ? (demo ? "Illustrative demo" : "Saved agent assessment") : (assessment ? "Overall score unavailable" : "Not assessed")}</p></div>
    </div>
    {expanded && assessment && <p className="mt-4 text-xs leading-relaxed text-board-muted">{demo ? "Illustrative example only; not a live assessment or hiring prediction." : `Recorded ${assessment.assessedAt || "date unavailable"}. ${assessment.evidence || ""} This assessment is not a hiring prediction.`}</p>}
  </section>;
}
