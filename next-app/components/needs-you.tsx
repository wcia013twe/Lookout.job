"use client";
import {useActionBoard,type BoardItem} from '../lib/use-action-board';
import {DecisionButtons} from './decision-buttons';
import {decisionTitle,decisionFeedback} from '../../lib/action-board.mjs';
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
  const board=useActionBoard();
  const [feedback,setFeedback]=useState('');
  const [answerPolicies,setAnswerPolicies]=useState<Record<string,string>>({});
  const [reviewDecision,setReviewDecision]=useState<BoardItem|null>(null);
  async function respond(item:BoardItem,response:string,policy?:string){try{await board.respond(item,response,policy);setFeedback(decisionFeedback(item,response));return true;}catch{return false;}}
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
  useEffect(()=>{if(!board.snapshot)return;let saved=0;try{saved=Number(sessionStorage.getItem('lookout:board-scroll'));sessionStorage.removeItem('lookout:board-scroll');}catch{}if(saved>0)requestAnimationFrame(()=>window.scrollTo(0,saved));},[!!board.snapshot]);
  const applications=Object.values(w.state.workflow.applications as Record<string,Application>);
  const actions=pendingActions(inbox,Date.now()).map(item=>({item,application:applications.find(app=>app.backendId===item.application_id)}));
  const decisionHistory=board.snapshot?.history.filter(item=>!['review_application','resolve_blocker','check_submission'].includes(item.source_kind||'review_application')||!inbox.some(row=>row.application_id===item.source_id&&row.resolved_at))||[];
  const history=inbox.filter(item=>item.resolved_at).sort((a,b)=>String(b.resolved_at).localeCompare(String(a.resolved_at)));
  if (w.demo&&!w.state.demo?.connectedBoard) return <DemoNeedsYou />;
  const handoffCount = (board.snapshot?.items.length ?? actions.length) + (setup ? 1 : 0);
  return (
    <>
      <Heading title="Action Board" />
      <div className="action-board-layout grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <SurfacePanel className="action-widget needs-you-priority" aria-labelledby="checklist-heading">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="checklist-heading" className="widget-heading text-xl font-semibold"><TaskIcon />Your next actions</h2></div>
            <span className="action-widget-count rounded-md px-2 py-1 text-xs font-semibold tabular-nums">{handoffCount}</span>
          </div>
          {(board.error||feedback)&&<p role="status" className="mt-3 text-sm">{board.error||feedback}</p>}{board.error&&<button type="button" onClick={()=>void board.refresh()} className="handoff-action">Reload actions</button>}
          {handoffCount ? <ul className="mt-3 divide-y divide-board-line">
            {setup && <NeedsYouRow title="Set up your application profile" context="Profile and résumé" reason="Verify your factual answers and add a résumé before Muse prepares applications." control={<Link href="/profile/" className="handoff-action" aria-label="Set up profile">Set up profile</Link>} />}
            {board.snapshot?.items.map(item=>{
              const application=applications.find(app=>app.backendId===item.applicationId);
              const accept=item.canAccept&&(!item.requiresReview||item.reviewed);
              return <NeedsYouRow key={item.key} title={decisionTitle(item)} context={[item.company,item.role||item.recipient].filter(Boolean).join(' · ')} reason={item.reason} role={application?{company:application.company,roleTitle:application.title,roleType:application.employmentType==='FT'?'Full-time':application.employmentType||'Type not recorded',date:(w.state.tracker.items[application.id]?.appliedDate?`Applied ${w.state.tracker.items[application.id].appliedDate}`:w.state.tracker.items[application.id]?.openedDate?`Opened ${w.state.tracker.items[application.id].openedDate}`:'Date not recorded'),status:w.state.tracker.items[application.id]?.status||'New',workflow:application.status}:undefined} decision={{canAccept:accept,canReject:item.canReject,disabled:board.busy||w.locked||!!board.error,onRespond:response=>void respond(item,response,item.kind==='verify_answer'?(answerPolicies[item.key]||'ask'):undefined)}} control={<>{application?<ActionButton label={`Review ${application.company}`} onClick={()=>{setReviewDecision(item);setReview(application.id);}}>{item.kind==='confirm_interview'?'Review interview':item.kind==='check_submission'?'Check submission':'Review application'}</ActionButton>:<Link className="handoff-action" onClick={()=>{try{sessionStorage.setItem("lookout:board-scroll",String(window.scrollY));}catch{}}} href={`${item.href}&returnTo=%2Fneeds-you%2F`}>{item.kind==='review_outreach'?'Review message':['verify_answer','missing_answer'].includes(item.kind)?'Edit answer':'Open details'}</Link>}<DecisionButtons item={item} chosenPolicy={answerPolicies[item.key]||'ask'} onPolicyChange={policy=>setAnswerPolicies(current=>({...current,[item.key]:policy}))} busy={board.busy||w.locked||!!board.error} onRespond={(response,policy)=>void respond(item,response,policy)}/></>}>
              {item.body&&item.kind!=='review_outreach'&&<p className="whitespace-pre-wrap text-sm text-board-muted">{item.body}</p>}
              {item.proposedAt&&<p className="text-sm">Proposed: {new Date(item.proposedAt).toLocaleString(undefined,{timeZone:item.timeZone||'UTC'})} · {item.timeZone||'UTC'}</p>}
              {item.kind==='resolve_blocker'&&item.questions?.filter(q=>!q.answer?.trim()&&(q as any).required!==false&&(q as any).fieldType!=='hidden').map((q,index)=><p className="mt-2 text-sm" key={index}>{q.question}</p>)}
              </NeedsYouRow>;
            })}
            {!board.snapshot&&actions.map(({item,application}) => {
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
          {!!(history.length+decisionHistory.length) && <details className="mt-5 border-t border-board-line pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Action history · {history.length+decisionHistory.length}</summary><ul className="divide-y divide-board-line">{history.map(item=><li className="py-3 text-sm" key={item.id}><p>{applications.find(app=>app.backendId===item.application_id)?.company || "Application"} · {item.reason}</p><p className="mt-1 text-xs text-board-muted">{item.resolution === "work_stopped" ? "Agent work stopped" : item.resolution === "superseded" ? "Replaced by updated action" : item.resolution === "user_reported_submitted" ? "You reported submission · retry blocked" : "Resolved"} · revision {item.revision} · {new Date(item.resolved_at!).toLocaleString()}</p><Link className="handoff-action" href={`/applications/?application=${item.application_id}`}>View application</Link></li>)}{decisionHistory.map(item=><li className="py-3 text-sm" key={item.decision_key}><p>{decisionTitle({kind:item.source_kind})} · {item.source_kind==='review_outreach'&&item.response==='accept'?'Ready for you to send':item.response==='accept'?'Accepted':'Rejected'}</p><p className="mt-1 text-xs text-board-muted">{new Date(item.responded_at).toLocaleString()}</p>{item.source_kind==='review_application'&&<Link className="handoff-action" href={`/applications/?application=${item.source_id}`}>View application</Link>}</li>)}</ul></details>}
        </SurfacePanel>
        <div><PreparationReminders /><NetworkFollowUps /></div>
      </div>
      {review && <DraftReview key={review} id={review} initialRoundId={reviewDecision?.kind==='confirm_interview'?reviewDecision.sourceId:undefined} initialTab={reviewDecision?.kind==='confirm_interview'?'Interview':'Documents'} boardDecision={reviewDecision?.kind==='review_application'?reviewDecision:undefined} onBoardReviewed={async()=>{if(reviewDecision&&!await respond(reviewDecision,'review'))throw Error('Review could not save');}} onClose={() => {setReview(null);setReviewDecision(null);void board.refresh();}} />}
    </>
  );
}
