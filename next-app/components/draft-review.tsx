"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { control, primary, secondary, Field, Notice, Section } from "./ui";
import { createBackend } from "../../backend/client.mjs";
import ApplicationTimeline from "./application-timeline";
import TimelineEditor from "./timeline-editor";
import SubmissionRecord from "./submission-record";
import type { SubmissionRecordProps } from "./submission-record";
import { ApplicationStatus } from "./workflow-surface";
import type { Application, SavedResume } from "./workflow-types";
export default function DraftReview({ id, onClose }: { id: string; onClose: () => void }) {
  const w = useWorkspace(),
    model = w.models.workflowModel;
  const current: Application | undefined = w.state.workflow.applications[id];
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
    [stage, setStage] = useState("Submitted"),
    [note, setNote] = useState("");
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordRetry, setRecordRetry] = useState(0);
  const [recordState, setRecordState] = useState<{ key: string; loading: boolean; error: string; data: Pick<SubmissionRecordProps, "application" | "attempts"> | null } | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState("");
  const recordKey = `${w.demo ? "demo" : w.user?.id || "local"}:${current?.backendId || ""}`;
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
  const editable = !w.demo && model.canEdit(current);
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
    if (w.demo) { setFeedback("Application actions are disabled in this fictional demo."); return; }
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
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="draft-review-heading"
      className="glass-panel fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-board-bg p-4 text-board-text backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:max-h-[90dvh] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="draft-review-heading" className="break-words text-xl font-bold">{current.company}</h2>
          <p className="mt-2 text-sm text-board-muted">{current.title}</p>
        </div>
        <button className={secondary} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-4"><ApplicationStatus status={current.status}>
        {current.receipt
          ? " · Employer confirmation observed"
          : current.status === "Submitted"
            ? " · Reported by you"
            : ""}
      </ApplicationStatus></div>
      <details className="mt-5 border-t border-board-line pt-3" onToggle={e => setRecordOpen(e.currentTarget.open)}>
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
            {downloadFeedback && <p role="status" className="mt-3 text-sm text-board-muted">{downloadFeedback}</p>}
          </>}
      </details>
      {w.demo && <Notice>This fictional application demonstrates saved answers and submission evidence. Approval, progress updates, and downloads are disabled.</Notice>}
      <form
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
      <Section title="Update application progress">
        <p className="mb-4 text-sm text-board-muted">
          Record an application you submitted yourself or a later outcome.
        </p>
        <Field label="Stage">
          <select
            className={control}
            disabled={w.demo}
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
            disabled={w.demo}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button
          className={`${secondary} mt-4`}
          disabled={busy || w.demo}
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
      <Notice>{feedback}</Notice>
      <Section title="Application timeline">
        <ApplicationTimeline application={current} demo={w.demo}/>
        <TimelineEditor application={current}/>
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
    </dialog>
  );
}
