"use client";
import { useEffect, useState } from "react";
import { primary, secondary, Empty } from "./ui";
import DraftReview from "./draft-review";
import ApplicationPreparation from "./application-preparation";
import { useWorkspace } from "../lib/workspace";
import ApplicationTimeline from "./application-timeline";
import TimelineEditor from "./timeline-editor";
import {sortApplications,hasCallback} from "../../application-timeline.mjs";
export default function ApplicationList({ items }) {
  const [review, setReview] = useState(null), [preparing, setPreparing] = useState(null), [editingTimeline,setEditingTimeline]=useState(null);
  const w = useWorkspace();
  useEffect(()=>{
    const requested=new URL(location.href).searchParams.get('application');
    const owned=items.find(item=>item.backendId===requested);
    if(owned)setReview(owned.id);
  },[w.user?.id,items.map(item=>item.backendId).join(',')]);
  return (
    <>
      <ul className="divide-y divide-board-line">
        {sortApplications(items).map((d) => (
          <li
            key={d.id}
            className="py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <strong>{d.company}</strong>
              <p className="mt-1 text-sm text-board-muted">{d.title}</p>
              <p className="mt-2 text-sm text-board-muted">
                {d.submittedResume ? <>{d.submittedResume.evidenceSource==='email'?'Resume recorded from email: ':'Submitted resume: '}<span className="font-semibold text-board-text">{d.submittedResume.name} · {d.submittedResume.version ? `v${d.submittedResume.version}` : 'version not recorded'}</span></> :
                  ['Submitted','Interview','Offer','Rejected','Withdrawn'].includes(d.status) ? 'Submitted resume version not recorded' :
                    (()=>{const selected=w.state.workflow.resumes.find(r=>r.id===d.resumeId);return selected?`Draft resume: ${selected.name} · ${selected.version?`v${selected.version}`:'version not recorded'}`:'Resume not selected';})()}
              </p>
              <p className="mt-2 text-xs text-board-accent">
                {hasCallback(d) && !["Rejected","Withdrawn"].includes(d.status) ? "Callback · " : ""}{d.status}
                {d.status === "Approved"
                  ? " · waiting for runner"
                  : d.receipt
                    ? " · employer confirmation observed"
                    : d.status === "Submitted"
                      ? " · reported by you"
                      : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            <button className={secondary} aria-expanded={preparing === d.id} onClick={() => setPreparing(preparing === d.id ? null : d.id)}>Prepare</button>
            <button className={secondary} onClick={() => setReview(d.id)}>
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
            <button className="mt-2 min-h-11 text-sm text-board-accent underline underline-offset-4" aria-expanded={editingTimeline===d.id} onClick={()=>setEditingTimeline(editingTimeline===d.id?null:d.id)}>Add timeline update</button>
            {editingTimeline===d.id && <TimelineEditor application={d}/>}
            {preparing === d.id && <ApplicationPreparation key={`${w.demo ? "demo" : w.user?.id || "guest"}:${d.id}`} application={{...w.roles.find(r=>r.id===d.id),...d}}/>}
          </li>
        ))}
      </ul>
      {review && (
        <DraftReview key={`${w.demo ? "demo" : w.user?.id || "guest"}:${review}`} id={review} onClose={() => setReview(null)} />
      )}
    </>
  );
}
