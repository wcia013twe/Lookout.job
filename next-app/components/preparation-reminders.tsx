"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBackend } from "../../backend/client.mjs";
import { buildPreparationAgenda, plannerToday, recordLocalPreparationSession, validatePlannerMinutes } from "../../lib/preparation-planner.mjs";
import { useWorkspace } from "../lib/workspace";
import DraftReview from "./draft-review";
import { TaskIcon } from "./needs-you-row";
import type { Application, PreparationPlan } from "./workflow-types";
import { Notice, control, primary, secondary } from "./ui";

type Target = { applicationId: string; jobId: string; taskId: string; expectedVersion: number; company: string; deadline: string };
type SessionInput = { sessionId: string; minutes: number; targets: { applicationId: string; taskId: string; expectedVersion: number }[] };
type Bundle = {
  applications?: Record<string, Application>;
  settings: { dailyMinutes: number; version: number };
  plans: { application_id: string; version: number; plan: PreparationPlan }[];
  sessions: { id: string; minutes: number; completed_at: string; targets: SessionInput["targets"] }[];
  timeZone: string;
};
type Item = { context?: string; id: string; title: string; detail: string; minutes: number; remainingAfter: number; shared: boolean; reason: string; targets: Target[] };
type Day = { date: string; plannedMinutes: number; completedMinutes: number; items: Item[]; interviews: { applicationId: string; company: string; stage: string }[] };
export type Agenda = { today: string; dailyMinutes: number; days: Day[]; unscheduled: number; dormantCount: number; uncertainCount: number; expiredCount: number };
const agendaFor = buildPreparationAgenda as unknown as (input: Bundle & { applications: Record<string, Application>; today: string }) => Agenda;
const localSession = recordLocalPreparationSession as unknown as (bundle: Bundle, input: SessionInput) => Bundle;
const calendarLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });

// Presentational boundary also used by the isolated demo/browser verification.
export function WeeklyPreparation({ agenda, minutes, onMinutes, onBudget, onComplete, onOpen, busy = false, locked = false }: {
  agenda: Agenda; minutes: string; onMinutes: (value: string) => void; onBudget: () => void;
  onComplete: (item: Item) => void; onOpen: (id: string) => void; busy?: boolean; locked?: boolean;
}) {
  const days = agenda.days.filter(day => day.items.length || day.interviews.length || day.completedMinutes);
  const scheduled = agenda.days.reduce((sum, day) => sum + day.plannedMinutes, 0);
  return <>
    <div className="flex items-start justify-between gap-3">
      <h2 id="prep-planner-heading" className="widget-heading text-lg font-semibold"><TaskIcon calendar />Weekly prep</h2>
      <span className="prep-total">{scheduled} min</span>
    </div>
    <p className="mt-2 text-xs text-board-muted">{calendarLabel(agenda.today, { month: "short", day: "numeric" })}–{agenda.days.length ? calendarLabel(agenda.days[agenda.days.length - 1].date, { month: "short", day: "numeric" }) : ""} · {agenda.dailyMinutes === 0 ? "Paused" : `${agenda.dailyMinutes} min/day`}</p>
    {!days.length && <p className="mt-5 text-sm text-board-muted">{agenda.dailyMinutes === 0 ? "Prep paused. Set daily minutes in Plan settings to resume." : "Add an interview date in Applications to plan your prep."}</p>}
    <div className="prep-agenda mt-4" aria-label="Weekly preparation agenda">
      {days.map(day => <section key={day.date} className={`prep-agenda-day ${day.interviews.length ? "prep-interview-day" : ""}`} aria-label={calendarLabel(day.date, { weekday: "long", month: "short", day: "numeric" })}>
        <h3 className={`prep-date ${day.date === agenda.today ? "prep-date-today" : ""}`}><span>{day.date === agenda.today ? "Today" : calendarLabel(day.date, { weekday: "short" })}</span><span className="prep-date-number">{calendarLabel(day.date, { day: "numeric" })}</span></h3>
        <div className="min-w-0">
          {day.interviews.map(interview => <button key={interview.applicationId} type="button" onClick={() => onOpen(interview.applicationId)} className="prep-interview"><TaskIcon calendar /><span><span className="prep-interview-label">Interview</span><strong className="block">{interview.company}</strong><span className="block text-xs font-normal">{interview.stage}</span></span></button>)}
          {day.completedMinutes > 0 && <p className="mb-2 text-xs text-board-accent">{day.completedMinutes} min practiced</p>}
          <ul className="space-y-2">{day.items.map(item => <li key={item.id} className="prep-session">
            <details className="min-w-0 flex-1">
              <summary className="prep-session-summary"><span className="min-w-0 flex-1">{item.title.replace(/\s*\(fictional demo resource\)/g, "")}</span><span className="prep-duration">{item.minutes} min</span>{item.context && <span className="prep-session-context">{item.context}</span>}</summary>
              <div className="pb-2 pt-1 text-xs leading-relaxed text-board-muted">
                <p>{item.detail}</p>
                <p className="mt-2">{item.reason}{item.remainingAfter ? ` · ${item.remainingAfter} min continues later` : ""}</p>
                <div className="mt-1 flex flex-wrap gap-x-3">{item.targets.map(target => <button key={`${target.applicationId}:${target.taskId}`} type="button" className="inline-flex min-h-11 items-center text-left font-semibold text-board-accent underline underline-offset-4" onClick={() => onOpen(target.jobId)}>{target.company}</button>)}</div>
              </div>
            </details>
            {day.date === agenda.today && <button type="button" className="prep-complete" aria-label={`Done: ${item.minutes} minute session, ${item.title}`} disabled={busy || locked} onClick={() => onComplete(item)}>Done<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></button>}
          </li>)}</ul>
        </div>
      </section>)}
    </div>
    {agenda.unscheduled > 0 && <Notice>{agenda.unscheduled} prep {agenda.unscheduled === 1 ? "task won’t" : "tasks won’t"} fit. Increase your daily budget.</Notice>}
    <details className="prep-settings mt-3 text-xs text-board-muted">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Plan settings &amp; details</summary>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); onBudget(); }}>
        <label className="block" htmlFor="prep-daily-budget">Minutes per day<input id="prep-daily-budget" type="number" min="0" max="240" step="1" required className={`${control} mt-1 max-w-32`} value={minutes} disabled={busy || locked} onChange={event => onMinutes(event.target.value)} /></label>
        <button type="submit" className={secondary} disabled={busy || locked || minutes === String(agenda.dailyMinutes)}>Save budget</button>
      </form>
      {!!(agenda.dormantCount || agenda.uncertainCount || agenda.expiredCount) && <p className="mt-4">Outside this week: {agenda.dormantCount} later interviews · {agenda.uncertainCount} dates to confirm · {agenda.expiredCount} past deadlines.</p>}
      <p className="mt-3 leading-relaxed">Shared practice counts once. The plan prioritizes closer interviews and fits your daily budget.</p>
    </details>
  </>;
}

export default function PreparationReminders() {
  const w = useWorkspace();
  return <Planner key={`${w.demo ? "demo" : w.user?.id || "guest"}`} />;
}
function Planner() {
  const w = useWorkspace(), owner = w.demo ? "demo" : w.user?.id || null;
  const [bundle, setBundle] = useState<Bundle | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [feedback, setFeedback] = useState("");
  const [minutes, setMinutes] = useState("45"), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [review, setReview] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const generation = useRef(0), mutation = useRef(false), sessionRequest = useRef<{ key: string; input: SessionInput } | null>(null);
  const services = useMemo(() => owner ? w.services || createBackend(w.client, owner) : null, [owner, w.services, w.client]);
  const timeZone = bundle?.timeZone || w.state.workflow.searchPreferences?.quietMode?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = plannerToday(clock, timeZone);
  const localPlans = w.state.workflow.preparationPlans, localPlanner = w.state.workflow.preparationPlanner;
  const applicationKey = Object.values(w.state.workflow.applications as Record<string, Application>).map(a => `${a.id}:${a.backendId || ""}`).sort().join("|");
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const epoch = ++generation.current;
    setLoading(true); setBusy(false); setError(""); setFeedback("");
    const load = services ? services.readPreparationPlanner() : Promise.resolve({
      settings: localPlanner?.settings || {dailyMinutes:45,version:0},sessions:localPlanner?.sessions || [],timeZone,
      plans:Object.entries(localPlans || {}).map(([id, plan]) => ({application_id:id,version:0,plan})),
    });
    load.then((value: Bundle) => { if (generation.current === epoch) { setBundle(value); setMinutes(String(value.settings.dailyMinutes)); } }).catch(() => { if (generation.current === epoch) setError("Your prep planner could not load. Reload to try again."); }).finally(() => { if (generation.current === epoch) setLoading(false); });
    return () => { generation.current++; };
  }, [services, applicationKey, retry, today, !owner && localPlans, !owner && localPlanner]);
  const applications = Object.fromEntries(Object.entries({ ...bundle?.applications, ...w.state.workflow.applications } as Record<string, Application>).map(([id, app]) => [id, { ...app, ...(['Rejected','Withdrawn'].includes(w.state.tracker.items[id]?.status) ? {status:w.state.tracker.items[id].status} : {}) }]));
  const rawAgenda = bundle ? agendaFor({ ...bundle, applications, today }) : null;
  const agenda = rawAgenda && bundle ? {...rawAgenda,days:rawAgenda.days.map(day => ({...day,items:day.items.map(item => {
    const details = item.targets.map(target => bundle.plans.find(row => row.application_id === target.applicationId)?.plan.tasks.find(task => task.id === target.taskId)?.detail).filter((detail): detail is string => !!detail);
    return {...item,context:details[0]?.split(/(?<=[.!?])\s/)[0]};
  })}))} : null;
  async function mutate(action: () => Promise<Bundle>, message: string) {
    if (mutation.current || w.locked) return;
    mutation.current = true; setBusy(true); setError(""); setFeedback("");
    const epoch = generation.current;
    try { const next = await action(); if (generation.current === epoch) { setBundle(next); setMinutes(String(next.settings.dailyMinutes)); setFeedback(message); } }
    catch { if (generation.current === epoch) setError("Preparation changed or could not save. Reload the planner before trying again."); }
    finally { mutation.current = false; if (generation.current === epoch) setBusy(false); }
  }
  function saveLocal(next: Bundle) {
    w.store.update('workflow', (current: { preparationPlans: Record<string, PreparationPlan> }) => ({ ...current, preparationPlans:{...current.preparationPlans,...Object.fromEntries(next.plans.map(row => [row.plan.applicationId,row.plan]))},preparationPlanner:{settings:next.settings,sessions:next.sessions} }));
    return next;
  }
  function saveBudget() {
    if (!bundle) return;
    let value: number;
    try { value = validatePlannerMinutes(minutes.trim() ? Number(minutes) : NaN); } catch { setError("Choose a daily budget between 0 and 240 minutes."); return; }
    mutate(async () => services ? services.savePreparationBudget(value, bundle.settings.version) : saveLocal({...bundle,settings:{dailyMinutes:value,version:bundle.settings.version+1}}), "Daily budget saved. Your week has been replanned.");
  }
  function complete(item: Item) {
    if (!bundle) return;
    const targets = item.targets.map(({applicationId,taskId,expectedVersion}) => ({applicationId,taskId,expectedVersion}));
    const key = JSON.stringify({id:item.id,targets,minutes:item.minutes});
    if (sessionRequest.current?.key !== key) sessionRequest.current = {key,input:{sessionId:crypto.randomUUID(),minutes:item.minutes,targets}};
    const input = sessionRequest.current.input;
    mutate(async () => services ? services.completePreparationSession(input) : saveLocal(localSession(bundle,input)), "Session recorded. Covered interviews and your remaining time are updated.");
  }
  return <section className="glass-panel action-widget prep-widget min-w-0 rounded-2xl p-5 md:p-6" aria-labelledby="prep-planner-heading" aria-busy={loading || busy}>
    {loading ? <><h2 id="prep-planner-heading" className="widget-heading text-lg font-semibold"><TaskIcon calendar />Weekly prep</h2><p role="status" className="mt-4 text-sm text-board-muted">Building your week…</p></> : agenda ? <WeeklyPreparation agenda={agenda} minutes={minutes} onMinutes={setMinutes} onBudget={saveBudget} onComplete={complete} onOpen={setReview} busy={busy || !!error} locked={w.locked} /> : <h2 id="prep-planner-heading" className="widget-heading text-lg font-semibold"><TaskIcon calendar />Weekly prep</h2>}
    {error && <div role="alert"><Notice>{error}</Notice><button type="button" className={`${secondary} mt-3`} onClick={() => {setBusy(false);setRetry(n => n + 1);}}>Reload planner</button></div>}
    {feedback && <p role="status" className="mt-3 text-sm text-board-muted">{feedback}</p>}
    {review && <DraftReview key={review} id={review} onClose={() => {setReview(null);setRetry(n => n + 1);}} />}
  </section>;
}
