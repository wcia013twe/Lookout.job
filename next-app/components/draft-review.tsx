"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { control, primary, secondary, Field, Notice, Section } from "./ui";
import { createBackend } from "../../backend/client.mjs";
import ApplicationDocumentsPreview from "./application-documents-preview";
import ApplicationOverview from "./application-overview";
import ApplicationTimeline from "./application-timeline";
import TimelineEditor from "./timeline-editor";
import SubmissionRecord from "./submission-record";
import type { SubmissionRecordProps } from "./submission-record";
import TrackerProgress, { CompanyMark } from "./tracker-progress";
import ApplicationPreparation from "./application-preparation";
import { timelineItems } from "../../lib/application-timeline.mjs";
import "./tracker.css";
import { dayStamp, awardStatus } from "../lib/progress.mjs";
import type { Application, SavedResume } from "./workflow-types";
export default function DraftReview({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useWorkspace(),
    model = w.models.workflowModel;
  const workflow: Application | undefined = w.state.workflow.applications[id];
  const role = w.roles.find((r: Application) => r.id === id);
  const current: Application | undefined = workflow || (role ? {...role, status: w.state.tracker.items[id]?.status || "New", questions: []} : undefined);
  const [tab, setTab] = useState("Overview");
  const [experience, setExperience] = useState<string | null>(null);
  const initial: Application = {
    id,
    company: "",
    title: "",
    status: "New",
    ...current,
    questions: (current?.questions || []).map((q) => {
      if (q.answer?.trim()) return q;
      const a = w.models.savedAnswerModel.automatic(
        w.state.workflow.savedAnswers,
        q.question,
        current?.company,
      );
      return a
        ? {
            ...q,
            answer: a.answer,
            savedAnswerId: a.id,
            savedAnswerVersion: a.version,
          }
        : q;
    }),
  };
  if (JSON.stringify(initial.questions) !== JSON.stringify(current?.questions))
    initial.questionsReviewed = false;
  const [draft, setDraft] = useState<Application>(initial),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState(model.trackingStages.includes(current?.status) ? current!.status : "Submitted"),
    [note, setNote] = useState("");
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordRetry, setRecordRetry] = useState(0);
  const [recordState, setRecordState] = useState<{ key: string; loading: boolean; error: string; data: Pick<SubmissionRecordProps, "application" | "attempts"> | null } | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState("");
  const recordKey = `${w.demo ? "demo" : w.user?.id || "local"}:${current?.backendId || ""}`;
  useEffect(() => { if (tab === "Documents") setRecordOpen(true); }, [tab]);
  const recordOwner = useRef(recordKey);
  recordOwner.current = recordKey;
  const recordMounted = useRef(false);
  useEffect(() => {
    recordMounted.current = true;
    return () => { recordMounted.current = false; };
  }, []);
  useEffect(() => {
    if (!recordOpen || (!w.demo && !w.user) || !current?.backendId) return;
    let cancelled = false;
    const key = recordKey;
    const ownerId = w.user?.id;
    setRecordState({ key, loading: true, error: "", data: null });
    setDownloadFeedback("");
    (w.services || createBackend(w.client, ownerId)).readSubmissionRecord(current.backendId)
      .then((data: Pick<SubmissionRecordProps, "application" | "attempts">) => {
        if (!cancelled && recordOwner.current === key && (w.demo || window.JB?.auth?.userId === ownerId))
          setRecordState({ key, loading: false, error: "", data });
      })
      .catch(() => {
        if (!cancelled && recordOwner.current === key && (w.demo || window.JB?.auth?.userId === ownerId))
          setRecordState({ key, loading: false, error: "Try loading the record again.", data: null });
      });
    return () => { cancelled = true; };
  }, [recordOpen, recordRetry, recordKey, w.client, w.services, current?.backendRevision, current?.status]);
  async function downloadRecordResume(resume: SavedResume) {
    const key = recordKey;
    if (w.demo || !w.user || !w.client || !resume.objectPath) return;
    setDownloadFeedback("");
    const destination = window.open("about:blank", "_blank");
    if (!destination) {
      setDownloadFeedback("Allow a new tab for Muse, then try the download again.");
      return;
    }
    destination.opener = null;
    try {
      const result = await (w.services || createBackend(w.client, w.user.id)).resumeLink(resume.objectPath);
      if (!recordMounted.current || recordOwner.current !== key || window.JB.auth?.userId !== w.user.id) {
        destination.close();
        return;
      }
      const url = new URL(result.signedUrl);
      if (url.protocol !== "https:") throw Error("Invalid download URL");
      destination.location.replace(url.href);
    } catch {
      destination.close();
      if (recordMounted.current && recordOwner.current === key)
        setDownloadFeedback("The saved résumé could not download. Try again.");
    }
  }
  const firstHydration = useRef(true);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    if (firstHydration.current) {
      firstHydration.current = false;
      return;
    }
    if (current) setDraft(current);
  }, [current?.revision, current?.backendRevision, current?.status]);
  if (!current) return null;
  const editable = !!workflow && !w.demo && !w.locked && model.canEdit(current);
  const unresolved = (current.submissionAttempts || []).find(
    (t) =>
      t.state === "uncertain" ||
      (t.state === "started" && Date.parse(t.startedAt) < Date.now() - 300000),
  );
  function field<K extends keyof Application>(key: K, value: Application[K]) {
    setDraft({ ...draft, [key]: value });
  }
  function question(index: number, key: "question" | "answer", value: string) {
    setDraft({
      ...draft,
      questionsReviewed: false,
      questions: draft.questions.map((q, i) => {
        if (i !== index) return q;
        const { savedAnswerId, savedAnswerVersion, ...rest } = q;
        return { ...rest, [key]: value };
      }),
    });
  }
  function collected() {
    return model.edit(w.store.get("workflow.applications")[id], {
      resumeId: draft.resumeId,
      questionsReviewed: draft.questionsReviewed,
      blocker: draft.blocker,
      questions: draft.questions,
    });
  }
  function save(value: Application) {
    w.store.update("workflow.applications", (apps: Record<string, Application>) => ({
      ...apps,
      [id]: value,
    }));
  }
  async function action(kind: "save" | "approve" | "record" | "recover") {
    if (w.demo || w.locked || !workflow) { setFeedback("Application actions are disabled in this fictional demo."); return; }
    setBusy(true);
    setFeedback("");
    try {
      const latest = editable ? collected() : current;
      if (kind === "record") model.recordStage(latest, stage, note);
      if (editable) save(latest);
      if (kind === "approve") {
        model.approve(
          latest,
          w.state.workflow.resumes.find((r: SavedResume) => r.id === latest.resumeId),
          w.state.workflow.profile,
        );
        if (w.user) await window.JB.cloud.approve(id);
        else
          save(
            model.approve(
              latest,
              w.state.workflow.resumes.find((r: SavedResume) => r.id === latest.resumeId),
              w.state.workflow.profile,
            ),
          );
        setFeedback("This version is approved. It has not been submitted.");
      } else if (kind === "record") {
        if (w.user) await window.JB.cloud.setStage(id, stage, note);
        else save(model.recordStage(latest, stage, note));
        setFeedback(
          "Progress recorded as your update. This action does not submit an application.",
        );
      } else if (kind === "recover") {
        if (!unresolved) throw Error("No unresolved attempt remains. Reopen the draft to review its current progress.");
        if (!note.trim())
          throw Error(
            "Check the employer portal or confirmation email and add a verification note first.",
          );
        await window.JB.cloud.resolveAttempt(id, unresolved.id, note);
        setFeedback(
          "Verified not submitted. Your agent can prepare a fresh attempt.",
        );
      } else setFeedback("Draft saved.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "This change could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function useAnswer(index: number, answer: { id: string; answer: string; version: number }) {
    setDraft({
      ...draft,
      questionsReviewed: false,
      questions: draft.questions.map((q, i) =>
        i === index
          ? {
              ...q,
              answer: answer.answer,
              savedAnswerId: answer.id,
              savedAnswerVersion: answer.version,
            }
          : q,
      ),
    });
  }
  const events = timelineItems(current);
  function createExperience() {
    setExperience([`${current!.company} — ${current!.title}`, "Interview experience (draft)", ...events.filter(e => ["recruiter_call","technical_round","interview","onsite"].includes(e.kind)).map(e => `${e.label} · ${e.phase} · ${e.occurred_at || "Date not recorded"}\n${e.source.note || ""}`), "\nTopics covered:\n\nWhat helped:\n\nAdvice for other candidates:"].join("\n\n"));
  }
  function downloadExperience() {
    const url = URL.createObjectURL(new Blob([experience || ""], {type:"text/plain"}));
    const link = document.createElement("a"); link.href=url; link.download="interview-experience-draft.txt"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="draft-review-heading" className="tracker-detail tracker-surface">
    <header className="tracker-detail-header"><CompanyMark company={current.company}/><div><h2 id="draft-review-heading">{current.title}</h2><p>{current.company}</p></div><button className="tracker-button tracker-close workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={onClose} aria-label="Close application details"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
    <div className="tracker-detail-grid"><div className="tracker-detail-main">
      <nav className="tracker-detail-tabs" aria-label="Application details">{["Overview","Documents","Prep","Rounds & email"].map(name=><button key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
      <div className="tracker-detail-content">
        {tab === "Overview" && <ApplicationOverview application={current} role={role} workflow={workflow} item={w.state.tracker.items[id] || {}} uncertain={Boolean(unresolved)} preparing={Boolean(workflow && model.canEdit(current))} demo={w.demo} onDocuments={() => setTab("Documents")} />}
        {tab === "Prep" && <><h3>Interview preparation</h3>{workflow ? <ApplicationPreparation application={{...role,...current}}/> : <p className="tracker-prose">Queue this role from Discover to create its preparation plan.</p>}</>}
        {tab === "Documents" && <><ApplicationDocumentsPreview application={current} draft={draft} profile={w.state.workflow.profile || {}} resume={w.state.workflow.resumes.find((r: SavedResume) => r.id === draft.resumeId)} hasDraft={Boolean(workflow)} recordApplication={recordState?.key === recordKey ? recordState.data?.application : undefined} attempts={recordState?.key === recordKey ? recordState.data?.attempts || [] : []} loading={Boolean(recordOpen && current.backendId && (w.demo || w.user) && (recordState?.key !== recordKey || recordState.loading))} error={recordState?.key === recordKey ? recordState.error || "" : ""} onRetry={() => setRecordRetry(value => value + 1)} onDownloadResume={w.demo ? undefined : downloadRecordResume} />{downloadFeedback && <p role="status" className="mt-3 text-sm text-board-muted">{downloadFeedback}</p>}      <details className="mt-5 border-t border-board-line pt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Submission record</summary>
        {(!w.demo && !w.user) || !current.backendId ? <p className="mt-3 text-sm text-board-muted">Sign in and sync this application to inspect its saved submission evidence.</p>
          : recordOpen && <>
            <SubmissionRecord
              application={recordState?.key === recordKey ? recordState.data?.application || {} : {}}
              attempts={recordState?.key === recordKey ? recordState.data?.attempts || [] : []}
              loading={recordState?.key !== recordKey || recordState.loading}
              error={recordState?.key === recordKey ? recordState.error : ""}
              onDownloadResume={w.demo ? undefined : downloadRecordResume}
            />
            {recordState?.key === recordKey && recordState.error && <button className={`${secondary} mt-3`} onClick={() => setRecordRetry(value => value + 1)}>Retry loading record</button>}

          </>}
      </details>
{editable && <p className="tracker-prose">Change the selected resume below before approving the draft.</p>}</>}

        {tab === "Rounds & email" && <><h3>Recruiting emails</h3>{events.filter(e=>e.source.kind === "email").length ? events.filter(e=>e.source.kind === "email").map(e=><article className="tracker-question" key={e.id}><h4>{e.source.subject || e.label}</h4><p>{e.source.excerpt || "No excerpt recorded."}</p><small>{e.source.receivedAt || "Received date not recorded"}</small>{!w.demo && e.source.url && <a href={e.source.url} target="_blank" rel="noopener noreferrer">Open source email</a>}</article>) : <p className="tracker-prose">No recruiting emails are linked to this application yet. Authorized inbox updates appear here when recorded.</p>}</>}
        {tab === "Documents" && <details className="application-documents-editor"><summary>Edit draft & review</summary><h3 className="mt-5">Draft editor</h3>{!workflow && <p>Queue this role from Discover to prepare application answers.</p>}{!draft.questions.length && <p className="tracker-prose">No employer questions recorded yet.</p>}      <form
        onSubmit={(e) => {
          e.preventDefault();
          action("save");
        }}
      >
        <fieldset disabled={!editable || busy} className="mt-5 space-y-4">
          <Field label="Resume">
            <select
              className={control}
              value={draft.resumeId}
              onChange={(e) => field("resumeId", e.target.value)}
            >
              <option value="">Select a resume</option>
              {w.state.workflow.resumes.map((r: SavedResume) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-board-muted">
            Profile:{" "}
            {[w.state.workflow.profile.name, w.state.workflow.profile.email]
              .filter(Boolean)
              .join(" · ") || "No factual profile saved"}
          </p>
          {draft.questions.map((q, i) => (
            <div
              key={model.questionId(q, i)}
              className="space-y-3 border-t border-board-line pt-5"
            >
              <Field label="Employer question">
                <textarea
                  className={control}
                  required
                  value={q.question}
                  onChange={(e) => question(i, "question", e.target.value)}
                />
              </Field>
              <Field label="Draft answer">
                <textarea
                  className={control}
                  value={q.answer}
                  onChange={(e) => question(i, "answer", e.target.value)}
                />
              </Field>
              {!q.answer.trim() &&
                w.models.savedAnswerModel
                  .matching(
                    w.state.workflow.savedAnswers,
                    q.question,
                    current.company,
                  )
                  .map((a: { id: string; answer: string; version: number; companyScope?: string }) => (
                    <button
                      type="button"
                      className={secondary}
                      key={a.id}
                      onClick={() => useAnswer(i, a)}
                    >
                      Use saved answer
                      {a.companyScope ? ` · ${a.companyScope}` : ""}
                    </button>
                  ))}
              <button
                type="button"
                className={secondary}
                onClick={() =>
                  setDraft({
                    ...draft,
                    questionsReviewed: false,
                    questions: draft.questions.filter(
                      (_, index) => i !== index,
                    ),
                  })
                }
              >
                Remove question
              </button>
            </div>
          ))}
          <button
            className={secondary}
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                questionsReviewed: false,
                questions: [
                  ...draft.questions,
                  { id: crypto.randomUUID(), question: "", answer: "" },
                ],
              })
            }
          >
            Add question
          </button>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-board-accent"
              checked={draft.questionsReviewed}
              onChange={(e) => field("questionsReviewed", e.target.checked)}
            />
            I reviewed the complete employer question list and answers.
          </label>
          <Field label="Blocker">
            <textarea
              className={control}
              value={draft.blocker || ""}
              onChange={(e) => field("blocker", e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button className={secondary} type="submit">
              Save draft
            </button>
            <button
              className={primary}
              type="button"
              onClick={() => action("approve")}
            >
              Approve this version
            </button>
          </div>
        </fieldset>
      </form>
</details>}
        {tab === "Rounds & email" && <><div className="tracker-section-heading mt-8"><h3>Interview rounds & history</h3><button className="tracker-button workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={createExperience}>Create experience card</button></div>      <Section title="Application timeline">
        <ApplicationTimeline application={current} demo={w.demo}/>
        {workflow && <TimelineEditor application={current}/>}
        <details className="mt-5"><summary className="min-h-11 cursor-pointer py-3 text-sm text-board-muted">Application activity</summary>
        <ol className="divide-y divide-board-line text-sm">
          {(current.activity || []).map((a, i) => (
            <li key={i} className="py-3 first:pt-0">
              {a.text}
              <small className="mt-1 block text-board-muted">
                {a.actor === "user" ? "You" : a.actor} ·{" "}
                {new Date(a.at).toLocaleString()}
              </small>
            </li>
          ))}
        </ol>
        </details>
      </Section>
{experience !== null && <section className="tracker-experience"><h3>Experience card preview</h3><p>Private draft. Edit what you want to share; nothing is published automatically.</p><label>Card content<textarea value={experience} maxLength={12000} onChange={e=>setExperience(e.target.value)}/></label><button className="tracker-button tracker-primary workspace-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={downloadExperience}>Download draft</button><button className="tracker-button workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>setExperience(null)}>Cancel</button></section>}</>}
      </div>
    </div><aside className="tracker-detail-sidebar"><section className="tracker-status-panel"><h3>Application Status</h3>{!workflow && <label>Hiring stage<select aria-label="Update hiring stage" disabled={w.locked} value={current.status} onChange={e=>{const status=e.target.value;awardStatus(w.store,id,status);w.store.update("tracker.items",(items:Record<string,unknown>)=>({...items,[id]:{...w.state.tracker.items[id],status,statusDate:dayStamp(),...(status!=="New"&&!w.state.tracker.items[id]?.appliedDate?{appliedDate:dayStamp()}:{})}}));}}>{["New","Applied","OA","Phone Screen","Interview","Onsite","Offer","Rejected","Withdrawn"].map(s=><option key={s} value={s}>{s==="New"?"Opened":s}</option>)}</select></label>}<TrackerProgress application={current} item={w.state.tracker.items[id] || {}} vertical/><details className="tracker-update"><summary>Update status</summary>      <Section title="Update application progress">
        <p className="mb-4 text-sm text-board-muted">
          Record an application you submitted yourself or a later outcome.
        </p>
        <Field label="Stage">
          <select
            className={control}
            disabled={w.demo || w.locked || !workflow}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {model.trackingStages.map((s: string) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Update / verification note">
          <input
            className={control}
            disabled={w.demo || w.locked || !workflow}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button
          className={`${secondary} mt-4`}
          disabled={busy || w.demo || w.locked || !workflow}
          onClick={() => action("record")}
        >
          Record update
        </button>
        {unresolved && !w.demo && w.user && editable && (
          <div className="mt-4">
            <p className="text-sm text-board-muted">
              Submission outcome is uncertain. Verify with the employer before
              allowing a retry.
            </p>
            <button
              className={`${secondary} mt-3`}
              disabled={busy}
              onClick={() => action("recover")}
            >
              Verified not submitted
            </button>
          </div>
        )}
      </Section>
</details></section><section className="tracker-notes"><h3>Notes</h3><div className="tracker-notes-body">{events.some(e=>e.source.note) ? events.filter(e=>e.source.note).map(e=><div key={e.id}><strong>{e.label}</strong><p>{e.source.note}</p></div>) : <p>Add notes, reminders, or interview experiences to a round.</p>}<button className="tracker-button workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>setTab("Rounds & email")}>Add round & note</button></div></section>{w.demo && <p className="tracker-prose">Fictional demo. Approval and submission actions are disabled.</p>}<Notice>{feedback}</Notice></aside></div>
  </dialog>;
}
