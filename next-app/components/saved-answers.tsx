"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
type AnswerFields = {
  question: string;
  answer: string;
  companyScope: string;
  policy: string;
  verified: boolean;
};
import { errorMessage, type AnswerRecord } from "./profile-types";
const previousEmploymentQuestion = "Have you worked for this company before?";
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
const empty: AnswerFields = {
  question: "",
  answer: "",
  companyScope: "",
  policy: "ask",
  verified: false,
};
export default function SavedAnswers() {
  const w = useWorkspace();
  const [fields, setFields] = useState(empty),
    [editing, setEditing] = useState<string | null>(null),
    [feedback, setFeedback] = useState(""),
    [showEditor, setShowEditor] = useState(false);
  const answers: AnswerRecord[] = w.state.workflow.savedAnswers || [];
  const companyQuestion = fields.question === previousEmploymentQuestion;
  function change<K extends keyof AnswerFields>(
    key: K,
    value: AnswerFields[K],
  ) {
    setFields({
      ...fields,
      [key]: value,
      ...(["question", "answer", "companyScope"].includes(key)
        ? { verified: false }
        : {}),
    });
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      let previous = answers.find((a) => a.id === editing);
      if (companyQuestion) {
        if (!fields.companyScope.trim())
          throw Error("Enter the company this answer applies to.");
        if (!["Yes", "No", "Ask me"].includes(fields.answer))
          throw Error("Choose Yes, No, or Ask me.");
        const matches = answers.filter(
          (a) =>
            normalize(a.question) === normalize(previousEmploymentQuestion) &&
            normalize(a.companyScope || "") === normalize(fields.companyScope),
        );
        if (!editing && matches.length > 1)
          throw Error(
            "More than one answer exists for this company. Edit the saved answer you want to keep.",
          );
        if (!editing) previous = matches[0];
      }
      const prepared = companyQuestion
        ? {
            ...fields,
            verified: fields.answer !== "Ask me" && fields.verified,
            policy:
              fields.answer !== "Ask me" && fields.verified ? "auto" : "ask",
          }
        : fields;
      const record = w.models.savedAnswerModel.save(prepared, previous);
      w.store.set("workflow.savedAnswers", [
        ...answers.filter((a) => a.id !== record.id),
        record,
      ]);
      setFields(empty);
      setEditing(null);
      setShowEditor(false);
      setFeedback("Answer saved.");
    } catch (e) {
      setFeedback(errorMessage(e));
    }
  }
  function remove(id: string) {
    w.store.set(
      "workflow.savedAnswers",
      answers.filter((a) => a.id !== id),
    );
    w.store.update("workflow.deletedAnswerIds", (v: string[]) => [
      ...new Set([...(v || []), id]),
    ]);
    if (editing === id) {
      setFields(empty);
      setEditing(null);
    }
  }
  return (
    <Section title="Saved answers">
      <p className="mb-4 text-sm text-board-muted">
        Exact-question answers, with optional company scope. Automatic reuse
        requires your review.
      </p>
      {!answers.length && (
        <p className="mt-6 border-t border-board-line pt-5 text-sm text-board-muted">
          No saved answers yet.
        </p>
      )}
      <ul className="mt-5 divide-y divide-board-line">
        {answers.map((a) => (
          <li key={a.id} className="py-4">
            <strong>{a.question}</strong>
            <p className="mt-2 whitespace-pre-wrap text-sm text-board-muted">
              {a.answer}
            </p>
            <p className="mt-2 text-xs text-board-muted">
              {a.companyScope || "Any company"} ·{" "}
              {a.imported && !a.verifiedAt
                ? "Imported proposal · Review before reuse"
                : a.policy === "auto" && a.verifiedAt
                  ? "Reviewed autofill"
                  : "Always ask me"}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                className={secondary}
                onClick={() => {
                  setEditing(a.id);
                  setShowEditor(true);
                  setFields({
                    ...a,
                    policy: a.imported ? a.requestedPolicy || "ask" : a.policy,
                    verified: false,
                  });
                }}
              >
                Edit
              </button>
              <button className={secondary} onClick={() => remove(a.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`${secondary} mt-4`}
        onClick={() => {
          if (!showEditor && companyQuestion) {
            setFields(empty);
            setEditing(null);
          }
          setShowEditor(!showEditor);
        }}
      >
        {showEditor ? "Close answer editor" : "Add employer answer"}
      </button>
      <button
        type="button"
        className={`${secondary} mt-4 ml-3`}
        onClick={() => {
          setEditing(null);
          setFields({
            ...empty,
            question: previousEmploymentQuestion,
            answer: "Ask me",
          });
          setShowEditor(true);
        }}
      >
        Worked here before?
      </button>
      {showEditor && (
        <div className="mt-5">
          {" "}
          <form onSubmit={save} className="space-y-4">
            {companyQuestion ? (
              <>
                <h3 className="font-semibold">{previousEmploymentQuestion}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company">
                    <input
                      className={control}
                      required
                      value={fields.companyScope}
                      onChange={(e) => change("companyScope", e.target.value)}
                      placeholder="Company name"
                    />
                  </Field>
                  <Field label="Your answer">
                    <select
                      className={control}
                      value={fields.answer}
                      onChange={(e) => change("answer", e.target.value)}
                    >
                      <option>Ask me</option>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Employer question">
                  <textarea
                    className={control}
                    required
                    value={fields.question}
                    onChange={(e) => change("question", e.target.value)}
                  />
                </Field>
                <Field label="Your answer">
                  <textarea
                    className={control}
                    required
                    rows={4}
                    value={fields.answer}
                    onChange={(e) => change("answer", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company scope (optional)">
                    <input
                      className={control}
                      value={fields.companyScope}
                      onChange={(e) => change("companyScope", e.target.value)}
                    />
                  </Field>
                  <Field label="Autofill policy">
                    <select
                      className={control}
                      value={fields.policy}
                      onChange={(e) => change("policy", e.target.value)}
                    >
                      <option value="ask">Always ask me</option>
                      <option value="auto">Allow reviewed autofill</option>
                    </select>
                  </Field>
                </div>
              </>
            )}
            {(!companyQuestion || fields.answer !== "Ask me") && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={fields.verified}
                  onChange={(e) => change("verified", e.target.checked)}
                />
                {companyQuestion
                  ? "I confirm this answer and allow reuse for this company."
                  : "I reviewed this answer."}
              </label>
            )}
            <button className={primary}>
              {companyQuestion
                ? "Save company answer"
                : editing
                  ? "Save answer changes"
                  : "Add answer"}
            </button>
            {editing && (
              <button
                className={`${secondary} ml-3`}
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFields(empty);
                }}
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      )}
      <Notice>{feedback}</Notice>
    </Section>
  );
}
