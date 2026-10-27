"use client";
import SurfacePanel from "./surface-panel";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading } from "./ui";
import {pendingActions,nextActionTime} from "../../lib/action-inbox.mjs";
import { useEffect, useState } from "react";
import DraftReview from "./draft-review";
import NeedsYouRow, { ActionButton, TaskIcon } from "./needs-you-row";
import DemoNeedsYou from "./demo-needs-you";
import PreparationReminders from "./preparation-reminders";
import NetworkFollowUps from "./network-follow-ups";
import type { Application } from "./workflow-types";
export default function NeedsYou() {
  const w = useWorkspace();
  const [review, setReview] = useState<string | null>(null);
  const setup =
    !w.state.workflow.profile.verified || !w.state.workflow.resumes.length;
  const [now,setNow]=useState(()=>Date.now());
  const inbox: {id:string;application_id:string;kind:string;reason:string;available_at:string;created_at:string;resolved_at:string|null;resolution:string|null;revision:number}[]=w.state.workflow.actionInbox || [];
  useEffect(()=>{
    const due=nextActionTime(inbox);
    if(due===null)return;
    const timer=setTimeout(()=>setNow(Date.now()),Math.min(2147483647,Math.max(0,due-Date.now()+1)));
    return ()=>clearTimeout(timer);
  },[inbox,now]);
  const applications=Object.values(w.state.workflow.applications as Record<string,Application>);
  const actions=pendingActions(inbox,Date.now()).map(item=>({item,application:applications.find(app=>app.backendId===item.application_id)}));
  const history=inbox.filter(item=>item.resolved_at).sort((a,b)=>String(b.resolved_at).localeCompare(String(a.resolved_at)));
  if (w.demo) return <DemoNeedsYou />;
  const handoffCount = actions.length + (setup ? 1 : 0);
  return (
    <>
      <Heading title="Action Board" />
      <div className="action-board-layout grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <SurfacePanel className="action-widget needs-you-priority" aria-labelledby="checklist-heading">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="checklist-heading" className="widget-heading text-xl font-semibold"><TaskIcon />Your next actions</h2></div>
            <span className="action-widget-count rounded-md px-2 py-1 text-xs font-semibold tabular-nums">{handoffCount}</span>
          </div>
          {handoffCount ? <ul className="mt-3 divide-y divide-board-line">
            {setup && <NeedsYouRow title="Set up your application profile" context="Profile and résumé" reason="Verify your factual answers and add a résumé before Muse prepares applications." control={<Link href="/profile/" className="handoff-action" aria-label="Set up profile">Set up profile</Link>} />}
            {actions.map(({item,application}) => {
              if(!application)return <NeedsYouRow key={item.id} title="Application action" context="Saved application" reason={item.reason} control={<Link href="/applications/" className="handoff-action">Open Applications</Link>}/>;
              const uncertain = item.kind === "check_submission";
              const title = uncertain ? "Check whether an application submitted" : item.kind === "resolve_blocker" ? "Resolve an application blocker" : "Review an application";
              const reason = item.reason;
              const tracked = w.state.tracker.items[application.id] || {};
              const date = tracked.appliedDate || tracked.openedDate;
              const dateLabel = date ? `${tracked.appliedDate ? "Applied" : "Opened"} ${new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(date.length === 10 ? { timeZone: "UTC" } : {}) })}` : "Date not recorded";
              return <NeedsYouRow key={item.id} title={title} context={`${application.company} · ${application.title}`} reason={reason} role={{company:application.company,roleTitle:application.title,roleType:application.employmentType === "FT" ? "Full-time" : application.employmentType || "Type not recorded",date:dateLabel,status:tracked.status || "New",workflow:application.status}} control={<ActionButton label={uncertain ? `Verify submission for ${application.company}` : `${title} for ${application.company}`} onClick={() => setReview(application.id)} disabled={w.locked}>{uncertain ? "Check submission" : item.kind === "resolve_blocker" ? "Resolve blocker" : "Review application"}</ActionButton>} />;
            })}
          </ul> : <div className="py-12 text-center"><svg aria-hidden="true" className="mx-auto text-board-success" width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M7 16.5 13 22l12-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="3" width="26" height="26" rx="8" stroke="currentColor" strokeWidth="1.5"/></svg><h3 className="mt-4 font-bold">Human handoffs are clear</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-board-muted">Muse can keep working without a decision from you right now.</p></div>}
          {!!history.length && <details className="mt-5 border-t border-board-line pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Action history · {history.length}</summary><ul className="divide-y divide-board-line">{history.map(item=><li className="py-3 text-sm" key={item.id}><p>{applications.find(app=>app.backendId===item.application_id)?.company || "Application"} · {item.reason}</p><p className="mt-1 text-xs text-board-muted">{item.resolution === "superseded" ? "Replaced by updated action" : item.resolution === "user_reported_submitted" ? "You reported submission · retry blocked" : "Resolved"} · revision {item.revision} · {new Date(item.resolved_at!).toLocaleString()}</p></li>)}</ul></details>}
        </SurfacePanel>
        <div><PreparationReminders /><NetworkFollowUps /></div>
      </div>
      {review && <DraftReview key={review} id={review} onClose={() => setReview(null)} />}
    </>
  );
}
