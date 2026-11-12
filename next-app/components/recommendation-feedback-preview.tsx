"use client";
import {useEffect, useState} from "react";
import {useWorkspace} from "../lib/workspace";
import ProfileIcon from "./profile-icon";
import {control, secondary} from "./ui";

export function useFeedbackDesignPreview() {
  const {demo} = useWorkspace();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(demo && new URLSearchParams(window.location.search).get("feedbackDesign") === "1");
  }, [demo]);
  return enabled;
}

export default function RecommendationFeedbackPreview({target, kind = "job"}: {target: string; kind?: "job" | "network"}) {
  const enabled = useFeedbackDesignPreview();
  const [rating, setRating] = useState<"helpful" | "not-helpful" | null>(null);
  const [details, setDetails] = useState(false);
  const [reason, setReason] = useState("");
  if (!enabled) return null;
  const reasons = kind === "job" ? ["Role scope", "Experience fit", "Location", "Compensation"] : ["Relevant person", "Timing", "Relationship", "Suggested approach"];
  return <section className="mt-4 border-t border-board-line pt-3" aria-label={`Recommendation feedback for ${target}`} data-feedback-preview={kind}>
    <p className="mb-1 text-xs text-board-muted">Was this {kind === "job" ? "role" : "suggestion"} helpful?</p>
    <div className="flex flex-wrap items-center gap-2">
      {(["helpful", "not-helpful"] as const).map(value => <button key={value} type="button" className={`${secondary} !px-3 !text-xs ${rating === value ? "!border-board-accent !text-board-accent !bg-board-tag" : ""}`} aria-pressed={rating === value} onClick={() => {setRating(rating === value ? null : value); setDetails(false);}}>
        <ProfileIcon name={value === "helpful" ? "check" : "close"} width={15} height={15}/>{value === "helpful" ? "Helpful" : "Not helpful"}
      </button>)}
      {rating && <button type="button" className="min-h-11 text-xs text-board-muted underline underline-offset-4" aria-expanded={details} onClick={() => setDetails(!details)}>Add context</button>}
    </div>
    {rating && <p className="mt-1 text-xs text-board-muted" role="status">Preview selection only · click again to clear.</p>}
    {rating && details && <div className="mt-3 space-y-3">
      <label className="block text-xs text-board-muted">What influenced your feedback?<select className={`${control} mt-1`} value={reason} onChange={event => setReason(event.target.value)}><option value="">Choose a reason (optional)</option>{reasons.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-xs text-board-muted">Anything your agent should know?<textarea className={`${control} mt-1`} rows={2} placeholder="Optional context — stays in this preview"/></label>
      <p className="text-xs text-board-muted">Design only. No feedback is saved or sent to your agent. This does not hide, apply, approve, or send outreach.</p>
    </div>}
  </section>;
}
