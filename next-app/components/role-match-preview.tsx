"use client";
import {motion,useReducedMotion} from "framer-motion";
import ProfileIcon from "./profile-icon";
import {assessmentFactors} from "../../lib/job-assessment.mjs";
type ScoreReason = {score: number | null; reasoning: string};
type AssessmentMetadata = {percent?: number; assessedAt?: string; evidence?: string};
export type MatchPreview = AssessmentMetadata & ({skillsExperience: ScoreReason; compensation: ScoreReason; wellbeingCulture: ScoreReason; locationWorkSetting: ScoreReason} | {factors: {label:string; value:number|null; rating:string; reason:string}[]});
export default function RoleMatchPreview({ sample, expanded = false, animate = false, active = true, demo = false }: { sample?: MatchPreview; demo?: boolean; expanded?: boolean; animate?: boolean; active?: boolean }) {
  const reduced=useReducedMotion();
  const factors=assessmentFactors(sample);
  if (!sample || !factors.length) return <section aria-label="Job match preview" className="border-t border-board-line/60 pt-4">
    <h4 className="text-sm font-semibold">Match not assessed</h4>
    <p className="mt-1 text-xs leading-relaxed text-board-muted">Needs a comparison with your profile and preferences.</p>
  </section>;
  return <section aria-label="Job match preview" className="border-t border-board-line/60 pt-4">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="text-base font-semibold tabular-nums">{typeof sample.percent === "number" ? `${sample.percent}% job match` : "Job match"}</h4>
      <span className="text-xs text-board-muted">{demo ? "Illustrative demo" : "Saved agent assessment"}</span>
    </div>
    <div className="space-y-3">
      {factors.map((factor: {label:string; value:number|null; reason:string},index: number) => {
        const content = <><div className="flex justify-between gap-3 text-xs leading-5"><span className="inline-flex items-center gap-1.5">{factor.label}{expanded && <ProfileIcon name="chevron" width={13} height={13} />}</span><span className="shrink-0 tabular-nums text-board-muted" aria-label={factor.value === null ? "Unknown" : `${factor.value} out of 100`}>{factor.value === null ? "Unknown" : factor.value}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-board-line">{factor.value !== null && <motion.div initial={animate&&!reduced?{scaleX:0}:false} animate={{scaleX:animate&&!active?0:1}} transition={{duration:reduced?0:.75,delay:animate&&!reduced?index*.1:0}} className="h-full origin-left rounded-full bg-board-accent" style={{ width: `${factor.value}%` }} />}</div></>;
        return expanded ? <details key={factor.label}><summary className="min-h-11 cursor-pointer list-none rounded-md py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent">{content}</summary><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">{factor.reason}</p></details> : <div key={factor.label}>{content}</div>;
      })}
    </div>
    {expanded && <p className="mt-4 text-xs leading-relaxed text-board-muted">{demo ? "Illustrative scores only; not a live assessment or hiring prediction." : `Recorded ${sample.assessedAt || "date unavailable"}. ${sample.evidence || ""} Scores are an assessment, not a hiring prediction.`}</p>}
  </section>;
}
