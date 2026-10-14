"use client";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { secondary } from "./ui";
import { ApplicationStatus, PreparationDisclosure } from "./workflow-surface";
import type { Application } from "./workflow-types";
import ApplicationTimeline from "./application-timeline";
import TimelineEditor from "./timeline-editor";
import { sortApplications, hasCallback } from "../../application-timeline.mjs";
import DraftReview from "./draft-review";
import ApplicationPreparation from "./application-preparation";
import { useWorkspace } from "../lib/workspace";
export default function ApplicationList({ items }: { items: Application[] }) {
  const [review, setReview] = useState<string | null>(null), [preparing, setPreparing] = useState<string | null>(null);
  const w = useWorkspace();
  const [editingTimeline, setEditingTimeline] = useState<string | null>(null);
  useEffect(() => {
    const requested = new URL(location.href).searchParams.get("application");
    const owned = items.find(item => item.backendId === requested);
    if (owned) setReview(owned.id);
  }, [w.user?.id, items.map(item => item.backendId).join(",")]);
  return (
    <>
      <ul className="glass-panel divide-y divide-board-line rounded-2xl px-4 sm:px-5">
        {sortApplications(items).map((d: Application) => (
          <li
            key={d.id}
            className="py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-48">
              <strong>{d.company}</strong>
              <p className="mt-1 break-words text-sm text-board-muted">{d.title}</p>
              <p className="mt-2 text-sm text-board-muted">
                {d.submittedResume ? <>{d.submittedResume.evidenceSource==='email'?'Resume recorded from email: ':'Submitted resume: '}<span className="font-semibold text-board-text">{d.submittedResume.name} · {d.submittedResume.version ? `v${d.submittedResume.version}` : 'version not recorded'}</span></> :
                  ['Submitted','Interview','Offer','Rejected','Withdrawn'].includes(d.status) ? 'Submitted resume version not recorded' :
                    (()=>{const selected=w.state.workflow.resumes.find((r: { id: string; name: string; version?: number })=>r.id===d.resumeId);return selected?`Draft resume: ${selected.name} · ${selected.version?`v${selected.version}`:'version not recorded'}`:'Resume not selected';})()}
              </p>
              <div className="mt-2"><ApplicationStatus status={d.status}>
                {hasCallback(d) && !["Rejected", "Withdrawn"].includes(d.status) ? "Callback · " : ""}
                {d.status === "Approved"
                  ? " · waiting for runner"
                  : d.receipt
                    ? " · employer confirmation observed"
                    : d.status === "Submitted"
                      ? " · reported by you"
                      : ""}
              </ApplicationStatus></div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
            <button className={`${secondary} flex-1 sm:flex-none`} aria-label={`Prepare for ${d.title} at ${d.company}`} aria-controls={`preparation-${d.id}`} aria-expanded={preparing === d.id} onClick={() => setPreparing(preparing === d.id ? null : d.id)}>Prepare</button>
            <button className={`${secondary} flex-1 sm:flex-none`} onClick={() => setReview(d.id)}>
              {[
                "Submitted",
                "Interview",
                "Offer",
                "Rejected",
                "Withdrawn",
              ].includes(d.status)
                ? "View progress"
                : "Review"}
            </button>
            </div>
            </div>
            <ApplicationTimeline application={d} compact demo={w.demo}/>
            <button className="mt-2 min-h-11 text-sm text-board-accent underline underline-offset-4" aria-expanded={editingTimeline === d.id} onClick={() => setEditingTimeline(editingTimeline === d.id ? null : d.id)}>Add timeline update</button>
            {editingTimeline === d.id && <TimelineEditor application={d}/>}
            <AnimatePresence initial={false}>
              {preparing === d.id && <PreparationDisclosure key={d.id}><div id={`preparation-${d.id}`}><ApplicationPreparation key={`${w.demo ? "demo" : w.user?.id || "guest"}:${d.id}`} application={{...w.roles.find((r: Application)=>r.id===d.id),...d}}/></div></PreparationDisclosure>}
            </AnimatePresence>
          </li>
        ))}
      </ul>
      {review && (
        <DraftReview key={`${w.demo ? "demo" : w.user?.id || "guest"}:${review}`} id={review} onClose={() => setReview(null)} />
      )}
    </>
  );
}
