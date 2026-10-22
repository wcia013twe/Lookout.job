"use client";
import Link from "next/link";
import { useId } from "react";
import { timelineItems } from "../../lib/application-timeline.mjs";
import ProfileIcon from "./profile-icon";
import { primary, secondary } from "./ui";
import type { Application, PreparationPlan } from "./workflow-types";
type Focus = PreparationPlan["tasks"][number] & { key?: string; guideId?: string };
const roundKinds = ["recruiter_call", "phone_screen", "technical_round", "interview", "onsite"];
function safeLink(value?: string) {
  try { const url = new URL(value || ""); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function calendarDay(date: Date, timeZone?: string) {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", ...(timeZone ? { timeZone } : {}) };
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date); }
  catch { parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); }
  const value = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function dateLabel(value: string, timeZone?: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : { hour: "numeric", minute: "2-digit", timeZoneName: "short", ...(timeZone ? { timeZone } : {}) }) };
  try { return new Date(value).toLocaleString(undefined, options); } catch { return new Date(value).toLocaleString(); }
}
export default function InterviewBrief({ application, plan, demo, timeZone, onRounds }: {
  application: Application; plan?: PreparationPlan | null; demo: boolean; timeZone?: string; onRounds: () => void;
}) {
  const id = useId();
  const current = plan && [application.id, application.backendId].includes(plan.applicationId) ? plan : null;
  const now = new Date();
  const today = calendarDay(now,timeZone);
  const scheduled = timelineItems(application).filter(event => event.phase === "scheduled" && roundKinds.includes(event.kind));
  const round = scheduled.filter(event => !event.occurred_at || (event.occurred_at.length === 10 ? event.occurred_at >= today : Date.parse(event.occurred_at) >= now.getTime())).sort((a,b) => (a.occurred_at ? Date.parse(a.occurred_at) : Infinity) - (b.occurred_at ? Date.parse(b.occurred_at) : Infinity))[0];
  const deadline = current?.deadline;
  const source = round?.source || deadline?.source;
  const date = round ? round.occurred_at : deadline?.date;
  const uncertain = round ? !round.occurred_at : deadline?.status !== "confirmed" || Boolean(deadline?.date && deadline.date < today);
  const roundDay = round?.occurred_at ? round.occurred_at.length === 10 ? round.occurred_at : calendarDay(new Date(round.occurred_at),timeZone) : null;
  const outdated = Boolean(roundDay && deadline?.date && roundDay !== deadline.date);
  const order = ["practice", "mock-interview", "application", "company-research", "questions", "logistics"];
  const priorities = (current?.tasks || []).filter((task: Focus) => !task.completed && !task.guideId && !task.key?.startsWith("guide-") && !task.id.includes(":guide-")).sort((a: Focus,b: Focus) => {
    const rank = (task: Focus) => { const key = task.key || task.id.split(":").pop() || ""; const index = order.indexOf(key); return index < 0 ? order.length : index; };
    return rank(a)-rank(b);
  }).slice(0,3);
  const materials = (current?.guides || []).slice(0,3);
  const expectation = round?.source.note?.split("\n")[0] || "";
  const hasBrief = Boolean(current || round);
  return <section className="interview-brief" aria-labelledby={`${id}-heading`}>
    <header className="interview-brief-header"><div><h3 id={`${id}-heading`}>Interview brief</h3><p>{round?.label || deadline?.stage || "Your next round"}</p></div><ProfileIcon name="conversation" className="text-board-accent" width={25} height={25} /></header>
    {!hasBrief ? <div className="interview-brief-empty"><h4>No interview scheduled</h4><p>Add the round details when you have them. Saved priorities and materials will appear here once your brief is prepared.</p><button className={`${secondary} mt-4 gap-2`} onClick={onRounds}>View round details<ProfileIcon name="arrow" width={16} height={16}/></button></div> : <>
      <div className="interview-brief-round"><ProfileIcon name="clock" className="shrink-0 text-board-accent"/><div><h4>{round ? "Next round" : "Preparation deadline"}</h4>{date ? <p><time dateTime={date}>{dateLabel(date,timeZone)}</time></p> : <p>Date not confirmed</p>}<small>{round?.occurred_at ? round.occurred_at.length === 10 ? "Interview time not recorded" : "Scheduled round" : "Interview time not recorded"}</small></div>{(uncertain || outdated) && <span className="interview-brief-warning">{outdated ? "Brief needs updating" : "Needs confirmation"}</span>}</div>
      {expectation && <p className="interview-brief-expectation">{expectation}</p>}
      <section className="interview-brief-focus" aria-labelledby={`${id}-focus`}><h4 id={`${id}-focus`}>Focus on these</h4>{priorities.length ? <ul>{priorities.map(task => <li key={task.id}><ProfileIcon name="arrow" width={17} height={17} className="mt-1 shrink-0 text-board-success"/><div><h5>{task.title}</h5><p>{task.detail}</p></div></li>)}</ul> : <p className="interview-brief-muted">{current ? "No outstanding focus items are recorded." : "No priorities have been saved for this round yet."}</p>}</section>
      <section className="interview-brief-materials" aria-labelledby={`${id}-materials`}><h4 id={`${id}-materials`}>Useful materials</h4>{materials.length ? <ul>{materials.map(guide => <li key={guide.id}><ProfileIcon name="file" width={18} height={18} className="shrink-0 text-board-accent"/>{!demo && safeLink(guide.url) ? <a href={safeLink(guide.url)!} target="_blank" rel="noopener noreferrer">{guide.title}</a> : <span>{guide.title}</span>}</li>)}</ul> : <p className="interview-brief-muted">No round-specific materials saved yet.</p>}</section>
      <div className="interview-brief-actions"><Link href="/" className={`${primary} gap-2`}>Open Action Board<ProfileIcon name="arrow" width={16} height={16}/></Link><button className="min-h-11 text-sm font-semibold text-board-accent" onClick={onRounds}>Round details</button></div>
      <details className="interview-brief-sources"><summary>Sources & context<ProfileIcon name="chevron" width={17} height={17}/></summary>{source ? <div><h5>{source.kind === "email" ? source.subject || "Recruiter email" : "Recorded round details"}</h5>{source.excerpt && <blockquote>{source.excerpt}</blockquote>}{"note" in source && source.note && <p>{String(source.note)}</p>}{source.receivedAt && <small>Received: {source.receivedAt}</small>}{source.messageId && <small>Message reference: {source.messageId}</small>}{!demo && safeLink(source.url) && <a href={safeLink(source.url)!} target="_blank" rel="noopener noreferrer">Open source email</a>}</div> : <p>No round source has been saved.</p>}{materials.map(guide => <div key={guide.id}><h5>{guide.title}</h5><small>{guide.source || "Saved resource"}{guide.observedAt ? ` · Recorded ${guide.observedAt}` : ""}</small>{guide.evidence && <p>{guide.evidence}</p>}</div>)}{priorities.map(task => <div key={task.id}><h5>{task.title}</h5><p>{task.detail}</p></div>)}{outdated && <p>The saved preparation deadline differs from this round. Confirm its relevance in Rounds & email.</p>}{current?.warnings?.length ? <ul>{current.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul> : null}<p>Priorities come from your saved preparation plan. No new AI assessment runs when this brief opens.{demo ? " Fictional demo; external resources are disabled." : ""}</p></details>
    </>}
  </section>;
}
