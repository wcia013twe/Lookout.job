"use client";
import { useEffect, useId, useState } from "react";
import { createPreparationPlan, setPreparationTaskCompletion } from "../../preparation-model.mjs";
import { control, Field, Notice, primary } from "./ui";

export default function Preparation({ application, plan = null, onSave, timeZone }) {
  const formId = useId();
  const [date, setDate] = useState(plan?.deadline?.date || "");
  const [stage, setStage] = useState(plan?.deadline?.stage || "Interview");
  const [minutes, setMinutes] = useState(plan?.dailyMinutes || 45);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    setDate(plan?.deadline?.date || "");
    setStage(plan?.deadline?.stage || "Interview");
    setMinutes(plan?.dailyMinutes || 45);
    setError("");
    setFeedback("");
  }, [application?.id, plan?.deadline?.date, plan?.deadline?.stage, plan?.dailyMinutes]);
  if (!application) return <Notice>Choose a saved application to prepare for its next stage.</Notice>;
  const current = plan?.applicationId === application.id ? plan : null;
  const source = current?.deadline?.source;
  async function save(next, message) {
    setBusy(true); setError(""); setFeedback("");
    try {
      if (!onSave) throw new Error("Preparation saving is unavailable. Try again when your workspace is connected.");
      await onSave(next);
      setFeedback(message);
    } catch (failure) { setError(failure?.message || "Your plan could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  function build(event) {
    event.preventDefault();
    try {
      // A user date change is a manual confirmation; unchanged email dates retain provenance.
      const unchanged = date === current?.deadline?.date;
      const localDate = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const part = type => localDate.find(value => value.type === type).value;
      const next = createPreparationPlan({ application, previousPlan: current,
        deadline: { date, stage, confirmed: true, source: unchanged ? source : { kind: "manual" } },
        dailyMinutes: minutes, now: `${part("year")}-${part("month")}-${part("day")}`,
      });
      if (next.deadline.status !== "confirmed") throw new Error(next.warnings.join(" "));
      save(next, "Preparation plan saved.");
    } catch (failure) { setError(failure.message); }
  }
  return (
    <section aria-labelledby={`${formId}-heading`} className="mt-6 border-t border-board-line pt-6">
      <h3 id={`${formId}-heading`} className="text-lg font-bold">Prepare for {application.company || "your next interview"}</h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Use your saved application and a confirmed process deadline to plan the next steps. Resource suggestions follow the role’s requirements.</p>
      {source?.kind === "email" && <div className="mt-4 rounded-lg bg-board-tag p-4 text-sm">
        <p className="font-semibold">Deadline from email{source.subject ? `: ${source.subject}` : ""}</p>
        {source.excerpt && <blockquote className="mt-2 break-words text-board-muted">{source.excerpt}</blockquote>}
        <p className="mt-2 break-all text-xs text-board-muted">Message reference: {source.messageId || "Missing"}</p>
        {source.receivedAt && <p className="mt-1 text-xs text-board-muted">Received: {source.receivedAt}</p>}
        {source.url && <a className="mt-3 inline-flex min-h-11 items-center text-board-accent underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">Open source email</a>}
      </div>}
      {current?.deadline?.status === "needs_confirmation" && <Notice>Confirm the exact deadline below. Preparation tasks remain unscheduled until the date is supported.</Notice>}
      <form onSubmit={build} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Interview or process deadline"><input required type="date" className={control} value={date} onChange={event => setDate(event.target.value)} /></Field>
          <Field label="Process stage"><input required maxLength={100} className={control} value={stage} onChange={event => setStage(event.target.value)} placeholder="Technical interview" /></Field>
          <Field label="Minutes available per day"><input required type="number" min="15" max="240" className={control} value={minutes} onChange={event => setMinutes(event.target.value)} /></Field>
        </div>
        <p className="text-xs leading-relaxed text-board-muted">Saving confirms the date you entered. New email deadlines can update this plan when Muse supplies their source evidence.</p>
        <button type="submit" disabled={busy || !onSave} className={primary}>{busy ? "Saving…" : current ? "Update preparation plan" : "Build preparation plan"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-board-text">{error}</p>}
      {feedback && <Notice>{feedback}</Notice>}
      {current && <>
        {current.scheduleChanged && <Notice>Deadline updated from {current.previousDeadline || "unconfirmed"} to {current.deadline.date || "unconfirmed"}. Completed work is preserved.</Notice>}
        {current.warnings?.map((warning, index) => <Notice key={index}>{warning}</Notice>)}
        <div className="mt-7 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-bold">Your preparation checklist</h4>
          <span className="text-sm text-board-muted">{current.tasks.filter(task => task.completed).length} of {current.tasks.length} complete</span>
        </div>
        <ul className="mt-3 divide-y divide-board-line">
          {current.tasks.map(task => <li key={task.id} className="py-4">
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-board-accent" checked={task.completed} disabled={busy || !onSave} onChange={event => save(setPreparationTaskCompletion(current, task.id, event.target.checked), "Task updated.")} />
              <span className="min-w-0"><span className={`block text-sm font-semibold ${task.completed ? "text-board-muted line-through" : ""}`}>{task.title}</span>
                <span className="mt-1 block max-w-prose text-sm leading-relaxed text-board-muted">{task.detail}</span>
                <span className="mt-2 block text-xs tabular-nums text-board-muted">{task.completed ? "Completed" : task.dueDate ? `Prepare by ${task.dueDate}` : "Awaiting confirmed deadline"} · {task.minutes} min</span>
              </span>
            </label>
          </li>)}
        </ul>
        <h4 className="mt-6 font-bold">Resource guides</h4>
        {current.guides.length ? <ul className="mt-2 divide-y divide-board-line">{current.guides.map(guide => <li key={guide.id} className="py-3">
          <a className="inline-flex min-h-11 items-center text-sm font-semibold text-board-accent underline underline-offset-4" href={guide.url} target="_blank" rel="noopener noreferrer">{guide.title}</a>
          <p className="text-xs text-board-muted">Relevant to {guide.matchedTopics.join(", ")}. Use alongside any materials provided by the company.</p>
        </li>)}</ul> : <Notice>No matching guide in the current resource library. Start with the posting and the company’s supplied preparation materials.</Notice>}
      </>}
    </section>
  );
}
