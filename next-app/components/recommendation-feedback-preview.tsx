"use client";
import {useEffect, useId, useRef, useState} from "react";
import {useWorkspace} from "../lib/workspace";
import ProfileIcon from "./profile-icon";
import {control, primary, secondary} from "./ui";

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
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  if (!enabled) return null;
  const reasons = kind === "job" ? ["Role scope", "Experience fit", "Location", "Compensation"] : ["Relevant person", "Timing", "Relationship", "Suggested approach"];
  return <section className="mt-2 flex items-center gap-1" aria-label={`Recommendation feedback for ${target}`} data-feedback-preview={kind}>
    <span className="mr-1 text-xs text-board-muted">Helpful?</span>
    {(["helpful", "not-helpful"] as const).map(value => <button key={value} type="button" title={value === "helpful" ? "Yes, helpful" : "No, not helpful"} aria-label={value === "helpful" ? "Yes, helpful" : "No, not helpful"} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-board-muted hover:border-board-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent ${rating === value ? "!border-board-accent !text-board-accent !bg-board-tag" : ""}`} aria-pressed={rating === value} onClick={() => {
      if (value === "helpful" || rating === value) setRating(rating === value ? null : value);
      else {setReason(""); setNote(""); dialog.current?.showModal();}
    }}>
      <ProfileIcon name={value === "helpful" ? "check" : "close"} width={15} height={15}/>
    </button>)}
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-board-line bg-board-panel p-5 text-board-text shadow-2xl backdrop:bg-black/60">
      <form onSubmit={event => {event.preventDefault(); setRating("not-helpful"); dialog.current?.close();}}>
        <h2 id={titleId} className="text-base font-semibold">What missed the mark?</h2>
        <p id={descriptionId} className="mt-1 text-sm text-board-muted">Your feedback improves your own agent.</p>
        <p className="mt-3 truncate text-xs text-board-muted" title={target}>{target}</p>
        <label className="mt-4 block text-xs text-board-muted">Reason (optional)<select className={`${control} mt-1`} value={reason} onChange={event => setReason(event.target.value)}><option value="">Choose a reason</option>{reasons.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="mt-3 block text-xs text-board-muted">What should your agent do differently?<textarea className={`${control} mt-1`} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Optional feedback"/></label>
        <p className="mt-3 text-xs text-board-muted">Design preview only — feedback is not saved or sent to your agent.</p>
        <div className="mt-4 flex justify-end gap-2"><button type="button" className={secondary} onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className={primary}>Preview feedback</button></div>
      </form>
    </dialog>
  </section>;
}
