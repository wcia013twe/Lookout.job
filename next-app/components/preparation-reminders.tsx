"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBackend } from "../../backend/client.mjs";
import { setPreparationTaskCompletion } from "../../lib/preparation-model.mjs";
import { confirmedDeadlines, dueLabel, preparationReminders, unconfirmedDeadlineCount } from "../lib/action-board.mjs";
import { useWorkspace } from "../lib/workspace";
import type { Application, PreparationPlan } from "./workflow-types";
import { Notice, secondary } from "./ui";

type PreparationRow = { version: number; plan: PreparationPlan };
type Rows = Record<string, PreparationRow>;
const completePreparationTask = setPreparationTaskCompletion as unknown as (plan: PreparationPlan, taskId: string, completed: boolean) => PreparationPlan;

export default function PreparationReminders() {
  const w = useWorkspace();
  const applications = useMemo(() => w.state.workflow.applications as Record<string, Application>, [w.state.workflow.applications]);
  const owner = w.demo ? "demo" : w.user?.id || null;
  const applicationKey = Object.values(applications).map((application) => `${application.id}:${application.backendId || "local"}`).sort().join("|");
  const [rows, setRows] = useState<Rows>({});
  const [loading, setLoading] = useState(Boolean(owner));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  useEffect(() => {
    let active = true;
    setError("");
    setFeedback("");
    if (!owner) {
      const local = Object.fromEntries(Object.entries(w.state.workflow.preparationPlans || {}).map(([id, plan]) => [id, { version: 0, plan }]));
      setRows(local as Rows);
      setLoading(false);
      return () => { active = false; };
    }
    const services = w.services || createBackend(w.client, owner);
    const candidates = Object.values(applications).filter((application) => application.backendId);
    setLoading(true);
    Promise.allSettled(candidates.map(async (application) => [application.id, await services.readPreparation(application.backendId)] as const))
      .then((results) => {
        if (!active || ownerRef.current !== owner) return;
        const next: Rows = {};
        let failed = false;
        for (const result of results) {
          if (result.status === "rejected") { failed = true; continue; }
          const [id, row] = result.value;
          if (row) next[id] = row as PreparationRow;
        }
        setRows(next);
        if (failed) setError("Some preparation reminders could not load. Open the application to retry its plan.");
      })
      .finally(() => { if (active && ownerRef.current === owner) setLoading(false); });
    return () => { active = false; };
  }, [owner, applicationKey, w.client, w.services]);

  const plans = useMemo(() => Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, row.plan])), [rows]);
  const reminders = preparationReminders(plans, applications);
  const visibleReminders = reminders.slice(0, 6);
  const hiddenReminderCount = reminders.length - visibleReminders.length;
  const deadlines = confirmedDeadlines(plans, applications);
  const needsConfirmation = unconfirmedDeadlineCount(plans);

  async function complete(applicationId: string, taskId: string) {
    const row = rows[applicationId], application = applications[applicationId];
    if (!row || !application) return;
    const key = `${applicationId}:${taskId}`;
    setBusy(key); setError(""); setFeedback("");
    try {
      const nextPlan = completePreparationTask(row.plan, taskId, true);
      if (owner) {
        if (!application.backendId) throw new Error("This application has not synced yet.");
        const saved = await (w.services || createBackend(w.client, owner)).savePreparation(application.backendId, row.version, nextPlan);
        if (ownerRef.current !== owner) return;
        setRows((current) => ({ ...current, [applicationId]: saved as PreparationRow }));
      } else {
        w.store.set(`workflow.preparationPlans.${applicationId}`, nextPlan);
        setRows((current) => ({ ...current, [applicationId]: { version: 0, plan: nextPlan } }));
      }
      setFeedback("Task completed and cleared from your board.");
    } catch {
      setError("That task could not be completed. Reload the application plan and try again.");
    } finally {
      setBusy("");
    }
  }

  const nextDeadline = deadlines[0];
  return <div className="grid min-w-0 gap-4">
    <section className="glass-panel action-widget rounded-2xl p-5" aria-labelledby="reminders-heading" aria-busy={loading}>
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="reminders-heading" className="text-lg font-bold">Muse reminders</h2><p className="mt-1 text-sm leading-relaxed text-board-muted">Preparation work, ordered by the dates Muse has evidence for.</p></div>
        {!loading && <span className="action-widget-count rounded-md px-2 py-1 text-xs font-semibold tabular-nums">{reminders.length}</span>}
      </div>
      {loading ? <div className="mt-5 space-y-3" aria-label="Loading reminders"><span className="action-skeleton block h-4 w-3/4 rounded"/><span className="action-skeleton block h-4 w-1/2 rounded"/></div> : reminders.length ? <ul className="mt-4 divide-y divide-board-line">
        {visibleReminders.map((reminder) => <li key={reminder.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4 first:pt-1 last:pb-0">
          <button type="button" className="action-check" aria-label={`Complete ${reminder.title}`} disabled={busy === reminder.id || w.locked} onClick={() => complete(reminder.applicationId, reminder.taskId)} />
          <div className="min-w-0"><p className="text-sm font-semibold leading-snug">{reminder.title}</p><p className="mt-1 text-xs leading-relaxed text-board-muted">{reminder.company} · {reminder.minutes} min</p><p className="mt-2 text-xs font-semibold tabular-nums text-board-accent">{dueLabel(reminder.dueDate || reminder.deadlineDate, w.date)}</p></div>
        </li>)}
      </ul> : <p className="mt-5 text-sm leading-relaxed text-board-muted">No active preparation reminders. Confirmed interview plans will appear here.</p>}
      {hiddenReminderCount > 0 && <Link href="/applications/" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-board-accent underline decoration-board-line underline-offset-4">{hiddenReminderCount} more {hiddenReminderCount === 1 ? "reminder" : "reminders"} in Applications</Link>}
      {error && <Notice>{error}</Notice>}{feedback && <Notice>{feedback}</Notice>}
    </section>
    <section className="glass-panel action-widget rounded-2xl p-5" aria-labelledby="deadline-heading">
      <h2 id="deadline-heading" className="text-lg font-bold">Next deadline</h2>
      {nextDeadline ? <div className="mt-4"><p className="text-3xl font-bold tracking-[-0.03em] tabular-nums">{new Date(`${nextDeadline.date}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}</p><p className="mt-2 text-sm font-semibold">{nextDeadline.company} · {nextDeadline.stage}</p><p className="mt-2 text-sm text-board-muted">{nextDeadline.remaining ? `${nextDeadline.remaining} preparation ${nextDeadline.remaining === 1 ? "task" : "tasks"} remaining` : "Preparation complete"} · {nextDeadline.sourceKind === "email" ? "email evidence" : "manually confirmed"}</p></div> : <p className="mt-4 text-sm leading-relaxed text-board-muted">No confirmed deadline yet. Muse can organize dates here after a connected source confirms them, or after you do.</p>}
      {needsConfirmation > 0 && <p className="mt-4 border-t border-board-line pt-4 text-sm text-board-warning">{needsConfirmation} {needsConfirmation === 1 ? "deadline needs" : "deadlines need"} confirmation before reminders can be scheduled.</p>}
      <Link href="/applications/" className={`${secondary} mt-5 w-full`}>Review application plans</Link>
    </section>
  </div>;
}
