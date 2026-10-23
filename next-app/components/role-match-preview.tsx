"use client";
import {motion,useReducedMotion} from "framer-motion";
import ProfileIcon from "./profile-icon";
export type MatchPreview = { percent: number; factors: { label: string; value: number | null; rating: string; reason: string }[] };
const factors = ["Skills & experience", "Compensation", "Wellbeing & culture", "Location & work setting"];
export default function RoleMatchPreview({ sample, expanded = false, animate = false, active = true }: { sample?: MatchPreview; expanded?: boolean; animate?: boolean; active?: boolean }) {
  const reduced=useReducedMotion();
  if (!sample && !expanded) return <section aria-label="Job match preview" className="border-t border-board-line/60 pt-4">
    <h4 className="text-sm font-semibold">Match not assessed</h4>
    <p className="mt-1 text-xs leading-relaxed text-board-muted">Needs a comparison with your profile and preferences.</p>
  </section>;
  return <section aria-label="Job match preview" className="border-t border-board-line/60 pt-4">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="text-base font-semibold tabular-nums">{sample ? `${sample.percent}% job match` : "Job match pending"}</h4>
      <span className="text-xs text-board-muted">{sample ? "Illustrative demo" : "Not assessed"}</span>
    </div>
    <div className="space-y-3">
      {(sample?.factors || factors.map(label => ({ label, value: null, rating: "Unknown", reason: "No verified assessment yet. A score needs current job requirements, your profile and stated preferences." }))).map((factor,index) => {
        const content = <><div className="flex justify-between gap-3 text-xs leading-5"><span className="inline-flex items-center gap-1.5">{factor.label}{expanded && <ProfileIcon name="chevron" width={13} height={13} />}</span><span className={["Limited", "Partial"].includes(factor.rating) ? "text-board-warning" : factor.value !== null ? "text-board-success" : "text-board-muted"}>{factor.rating}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-board-line">{factor.value !== null && <motion.div initial={animate&&!reduced?{scaleX:0}:false} animate={{scaleX:animate&&!active?0:1}} transition={{duration:reduced?0:.75,delay:animate&&!reduced?index*.1:0}} className={`h-full origin-left rounded-full ${["Limited", "Partial"].includes(factor.rating) ? "bg-board-warning" : "bg-board-success"}`} style={{ width: `${factor.value}%` }} />}</div></>;
        return expanded ? <details key={factor.label}><summary className="min-h-11 cursor-pointer list-none rounded-md py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent">{content}</summary><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">{factor.reason}</p></details> : <div key={factor.label}>{content}</div>;
      })}
    </div>
    {expanded && <p className="mt-4 text-xs leading-relaxed text-board-muted">{sample ? "Illustrative scores only; not a live assessment or hiring prediction." : "A percentage needs verified job requirements and profile evidence."}</p>}
  </section>;
}
