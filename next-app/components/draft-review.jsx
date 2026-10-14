"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { control, primary, secondary, Field, Notice, Section } from "./ui";
export default function DraftReview({ id, onClose }) {
  const w = useWorkspace(),
    model = w.models.workflowModel;
  const current = w.state.workflow.applications[id];
  const initial = {
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
  const [draft, setDraft] = useState(initial),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState("Submitted"),
    [note, setNote] = useState("");
  const dialog = useRef(null);
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
    setDraft(current);
  }, [current?.revision, current?.backendRevision, current?.status]);
  if (!current) return null;
  const editable = model.canEdit(current);
  const unresolved = (current.submissionAttempts || []).find(
    (t) =>
      t.state === "uncertain" ||
      (t.state === "started" && Date.parse(t.startedAt) < Date.now() - 300000),
  );
  function field(key, value) {
    setDraft({ ...draft, [key]: value });
  }
  function question(index, key, value) {
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
  function save(value) {
    w.store.update("workflow.applications", (apps) => ({
      ...apps,
      [id]: value,
    }));
  }
  async function action(kind) {
    setBusy(true);
    setFeedback("");
    try {
      const latest = editable ? collected() : current;
      if (kind === "record") model.recordStage(latest, stage, note);
      if (editable) save(latest);
      if (kind === "approve") {
        model.approve(
          latest,
          w.state.workflow.resumes.find((r) => r.id === latest.resumeId),
          w.state.workflow.profile,
        );
        if (w.user) await window.JB.cloud.approve(id);
        else
          save(
            model.approve(
              latest,
              w.state.workflow.resumes.find((r) => r.id === latest.resumeId),
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
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  function useAnswer(index, answer) {
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-2xl border border-board-line bg-board-bg p-5 text-board-text backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{current.company}</h2>
          <p className="mt-2 text-sm text-board-muted">{current.title}</p>
        </div>
        <button className={secondary} onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mt-4 text-sm text-board-muted">
        {current.status}
        {current.receipt
          ? " · Employer confirmation observed"
          : current.status === "Submitted"
            ? " · Reported by you"
            : ""}
      </p>
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
              {w.state.workflow.resumes.map((r) => (
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
              className="space-y-3 rounded-xl border border-board-line p-4"
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
                  .map((a) => (
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
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-board-accent"
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
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {model.trackingStages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Update / verification note">
          <input
            className={control}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <button
          className={`${secondary} mt-4`}
          disabled={busy}
          onClick={() => action("record")}
        >
          Record update
        </button>
        {unresolved && w.user && editable && (
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
      <Section title="Timeline">
        <ol className="space-y-3 text-sm">
          {(current.activity || []).map((a, i) => (
            <li key={i}>
              {a.text}
              <small className="mt-1 block text-board-muted">
                {a.actor === "user" ? "You" : a.actor} ·{" "}
                {new Date(a.at).toLocaleString()}
              </small>
            </li>
          ))}
        </ol>
      </Section>
    </dialog>
  );
}
