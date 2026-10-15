"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBackend } from "../../backend/client.mjs";
import { buildPreparationAgenda, plannerToday, recordLocalPreparationSession, validatePlannerMinutes } from "../../lib/preparation-planner.mjs";
import { useWorkspace } from "../lib/workspace";
import DraftReview from "./draft-review";
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
type Item = { id: string; title: string; detail: string; minutes: number; remainingAfter: number; shared: boolean; reason: string; targets: Target[] };
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
  const [selectedDate, setSelectedDate] = useState<string | null>(agenda.today);
  const focusedDate = agenda.days.some(day => day.date === selectedDate) ? selectedDate : null;
  const days = agenda.days.filter(day => !focusedDate || day.date === focusedDate);
  const scheduled = agenda.days.reduce((sum, day) => sum + day.plannedMinutes, 0);
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="prep-planner-heading" className="text-lg font-bold">This week’s prep</h2><p className="mt-1 max-w-prose text-sm leading-relaxed text-board-muted">One plan across your interviews. Shared practice counts once.</p></div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); onBudget(); }}>
        <label className="block text-xs text-board-muted" htmlFor="prep-daily-budget">Minutes per day<input id="prep-daily-budget" type="number" min="0" max="240" step="1" required className={`${control} mt-1 max-w-32`} value={minutes} disabled={busy || locked} onChange={event => onMinutes(event.target.value)} /></label>
        <button type="submit" className={secondary} disabled={busy || locked || minutes === String(agenda.dailyMinutes)}>Save budget</button>
      </form>
    </div>
    <p className="mt-4 text-sm tabular-nums text-board-muted">{scheduled} min planned over the next 7 days · {agenda.dailyMinutes} min daily limit{agenda.dailyMinutes === 0 ? " · Paused" : ""}</p>
    <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" aria-label="Preparation calendar">
      {agenda.days.map(day => <button key={day.date} type="button" aria-pressed={selectedDate === day.date} aria-label={`${calendarLabel(day.date, { weekday: "long", month: "short", day: "numeric" })}: ${day.plannedMinutes} minutes prep, ${day.interviews.length} interviews${day.completedMinutes ? `, ${day.completedMinutes} minutes completed` : ""}`} onClick={() => setSelectedDate(current => current === day.date ? null : day.date)} className={`flex min-h-24 min-w-0 flex-col items-center rounded-lg border px-1 py-3 text-center ${selectedDate === day.date ? "border-board-accent bg-board-tag" : "border-board-line"}`}>
        <span className="text-xs text-board-muted">{calendarLabel(day.date, { weekday: "short" })}</span><span className={`mt-1 text-lg font-bold tabular-nums ${day.date === agenda.today ? "text-board-accent" : ""}`}>{calendarLabel(day.date, { day: "numeric" })}</span>
        <span className="mt-1 text-xs tabular-nums text-board-muted">{day.plannedMinutes}m</span>
        <span aria-hidden="true" className={`mt-2 size-1.5 rounded-full ${day.interviews.length ? "bg-board-accent" : "bg-transparent"}`} />
      </button>)}
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-board-muted"><span>A dot marks an interview · tap a day to focus</span>{selectedDate && <button type="button" className="min-h-11 font-semibold text-board-accent underline underline-offset-4" onClick={() => setSelectedDate(null)}>Show all week</button>}</div>
    {!agenda.days.some(day => day.items.length || day.interviews.length || day.completedMinutes) && <p className="mt-3 text-sm text-board-muted">Confirm an upcoming round date inside Applications to build your week.</p>}
    <div className="mt-3 divide-y divide-board-line">
      {days.map(day => <section key={day.date} className="py-5" aria-label={calendarLabel(day.date, { weekday: "long", month: "short", day: "numeric" })}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-bold">{day.date === agenda.today ? "Today" : calendarLabel(day.date, { weekday: "long" })} <span className="font-normal text-board-muted">· {calendarLabel(day.date, { month: "short", day: "numeric" })}</span></h3><span className="text-xs tabular-nums text-board-muted">{day.completedMinutes ? `${day.completedMinutes}m done · ` : ""}{day.plannedMinutes}m planned</span></div>
        {day.interviews.map(interview => <button key={interview.applicationId} type="button" onClick={() => onOpen(interview.applicationId)} className="mt-2 flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-board-accent"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-board-accent" />{interview.company} · {interview.stage}</button>)}
        {day.items.length ? <ul className="mt-2 space-y-5">{day.items.map(item => <li key={item.id} className="flex items-start gap-3">
          <button type="button" className="action-check mt-1 shrink-0" aria-label={`Complete ${item.minutes} minute session: ${item.title}`} title={day.date === agenda.today ? "Record this practice session" : "Available on the scheduled day"} disabled={busy || locked || day.date !== agenda.today} onClick={() => onComplete(item)} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h4 className="text-sm font-semibold">{item.title}</h4><span className="text-xs font-semibold tabular-nums text-board-accent">{item.minutes} min</span></div>
            <p className="mt-1 text-xs leading-relaxed text-board-muted">{item.shared ? item.detail : "Company-specific preparation. Open the interview for details and sources."}</p>
            <p className="mt-2 text-xs text-board-muted">{item.reason}{item.remainingAfter ? ` · ${item.remainingAfter}m continues later` : ""}</p>
            <div className="mt-1 flex flex-wrap gap-x-3">{item.targets.map(target => <button key={`${target.applicationId}:${target.taskId}`} type="button" className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-board-accent underline decoration-board-line underline-offset-4" onClick={() => onOpen(target.jobId)}>{target.company}</button>)}</div>
          </div>
        </li>)}</ul> : <p className="mt-3 text-sm leading-relaxed text-board-muted">{agenda.dailyMinutes === 0 ? "Prep is paused. Set a daily budget when you’re ready." : day.completedMinutes >= agenda.dailyMinutes ? "Your time budget is used. You’re done for today." : "No prep scheduled. Keep this time free."}</p>}
      </section>)}
    </div>
    {agenda.unscheduled > 0 && <Notice>{agenda.unscheduled} interview {agenda.unscheduled === 1 ? "task does" : "tasks do"} not fit before the rounds within this budget. Increase your time or focus on the most important sessions.</Notice>}
    {!!(agenda.dormantCount || agenda.uncertainCount || agenda.expiredCount) && <p className="mt-3 text-xs leading-relaxed text-board-muted">Outside this week: {agenda.dormantCount} later interviews · {agenda.uncertainCount} dates to confirm · {agenda.expiredCount} past deadlines. Details remain in each interview.</p>}
    <details className="mt-4 border-t border-board-line pt-3 text-xs text-board-muted"><summary className="min-h-11 cursor-pointer py-3 font-semibold">How this plan is chosen</summary><p className="max-w-prose leading-relaxed">The planner fits sessions within each day’s remaining time. It favors practice that covers more interviews and closer deadlines, with extra weight for roles marked Apply Now. Company-specific work stays separate. Completed sessions use your budget once, even when they help several interviews.</p></details>
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
  const agenda = bundle ? agendaFor({ ...bundle, applications, today }) : null;
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
  return <section className="glass-panel action-widget min-w-0 rounded-2xl p-5 md:p-6" aria-labelledby="prep-planner-heading" aria-busy={loading || busy}>
    {loading ? <><h2 id="prep-planner-heading" className="text-lg font-bold">This week’s prep</h2><p role="status" className="mt-4 text-sm text-board-muted">Building your week…</p></> : agenda ? <WeeklyPreparation agenda={agenda} minutes={minutes} onMinutes={setMinutes} onBudget={saveBudget} onComplete={complete} onOpen={setReview} busy={busy || !!error} locked={w.locked} /> : <h2 id="prep-planner-heading" className="text-lg font-bold">This week’s prep</h2>}
    {error && <div role="alert"><Notice>{error}</Notice><button type="button" className={`${secondary} mt-3`} onClick={() => {setBusy(false);setRetry(n => n + 1);}}>Reload planner</button></div>}
    {feedback && <p role="status" className="mt-3 text-sm text-board-muted">{feedback}</p>}
    {review && <DraftReview key={review} id={review} onClose={() => {setReview(null);setRetry(n => n + 1);}} />}
  </section>;
}
