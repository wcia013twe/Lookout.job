"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
const empty = {
  question: "",
  answer: "",
  companyScope: "",
  policy: "ask",
  verified: false,
};
export default function SavedAnswers() {
  const w = useWorkspace();
  const [fields, setFields] = useState(empty),
    [editing, setEditing] = useState(null),
    [feedback, setFeedback] = useState("");
  const answers = w.state.workflow.savedAnswers;
  function change(key, value) {
    setFields({
      ...fields,
      [key]: value,
      ...(["question", "answer", "companyScope"].includes(key)
        ? { verified: false }
        : {}),
    });
  }
  function save(e) {
    e.preventDefault();
    try {
      const record = w.models.savedAnswerModel.save(
        fields,
        answers.find((a) => a.id === editing),
      );
      w.store.set("workflow.savedAnswers", [
        ...answers.filter((a) => a.id !== record.id),
        record,
      ]);
      setFields(empty);
      setEditing(null);
      setFeedback("Answer saved.");
    } catch (e) {
      setFeedback(e.message);
    }
  }
  function remove(id) {
    w.store.set(
      "workflow.savedAnswers",
      answers.filter((a) => a.id !== id),
    );
    w.store.update("workflow.deletedAnswerIds", (v) => [
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
      <form onSubmit={save} className="space-y-4">
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
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={fields.verified}
            onChange={(e) => change("verified", e.target.checked)}
          />
          I reviewed this answer.
        </label>
        <button className={primary}>
          {editing ? "Save answer changes" : "Add answer"}
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
      <Notice>{feedback}</Notice>
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
            <div className="mt-3 flex gap-3">
              <button
                className={secondary}
                onClick={() => {
                  setEditing(a.id);
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
    </Section>
  );
}
