"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "../lib/workspace";
import { uploadResume, resumeDownloadUrl } from "../../lib/resume-model.mjs";
import { control, primary, secondary, Field, Section, Notice } from "./ui";
import { errorMessage, type ResumeRecord } from "./profile-types";
type ResumeForm = HTMLFormElement & {
  elements: HTMLFormControlsCollection & {
    variant: HTMLSelectElement;
    name: HTMLSelectElement;
    file: HTMLInputElement;
    url: HTMLInputElement;
  };
};
const variants = [
  "Backend",
  "Distributed Systems",
  "ML Infrastructure",
  "Master",
];
export default function Resumes() {
  const w = useWorkspace(),
    resumes: ResumeRecord[] = w.state.workflow.resumes || [];
  const [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as ResumeForm;
    setBusy(true);
    try {
      if (!w.user || !window.JB.cloud.ready)
        throw Error("Sign in and wait for your account to connect first.");
      const variant = form.elements.variant.value;
      const version =
        1 +
        Math.max(
          0,
          ...resumes
            .filter((r) => r.variant === variant)
            .map((r) => Number(r.version) || 1),
        );
      const row = await uploadResume({
        client: w.client,
        getOwner: () => window.JB.auth.userId,
        file: form.elements.file.files?.[0],
        variant,
        version,
      });
      w.store.update("workflow.resumes", (v: ResumeRecord[]) => [
        ...v,
        {
          id: row.id,
          name: row.name,
          variant: row.variant,
          version: row.version,
          objectPath: row.object_path,
          contentHash: row.content_hash,
          url: "",
        },
      ]);
      form.reset();
      setFeedback(
        "Private resume uploaded. Select it when reviewing an application.",
      );
    } catch (e) {
      setFeedback(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function reference(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as ResumeForm;
    const url = form.elements.url.value.trim();
    if (!(w.user ? /^https:\/\// : /^https?:\/\//).test(url)) {
      setFeedback("Use an HTTPS resume URL.");
      return;
    }
    w.store.update("workflow.resumes", (v: ResumeRecord[]) => [
      ...v,
      {
        id: crypto.randomUUID(),
        name: form.elements.name.value,
        variant: form.elements.name.value,
        url,
        version: 1,
      },
    ]);
    form.reset();
    setFeedback("Resume reference saved.");
  }
  async function open(r: ResumeRecord) {
    if (w.demo) {
      setFeedback("Private files are unavailable in demo mode.");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    try {
      if (popup) popup.opener = null;
      const url = await resumeDownloadUrl({
        client: w.client,
        getOwner: () => window.JB.auth.userId,
        resume: r,
      });
      if (popup) popup.location.replace(url);
      else setFeedback("Allow pop-ups, then open the resume again.");
    } catch (e) {
      popup?.close();
      setFeedback(errorMessage(e));
    }
  }
  return (
    <Section title="Resume variants">
      {!resumes.length && (
        <p className="mt-6 border-t border-board-line pt-5 text-sm text-board-muted">
          No resume variants saved yet.
        </p>
      )}
      <ul className="mt-5 divide-y divide-board-line">
        {resumes.map((r) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 py-4"
            key={r.id}
          >
            <strong className="min-w-0 break-words">
              {r.name}{" "}
              <small className="text-board-muted">v{r.version || 1}</small>
            </strong>
            {r.objectPath ? (
              <button className={secondary} onClick={() => open(r)}>
                Open private resume
              </button>
            ) : (
              <a
                className={secondary}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open reference
              </a>
            )}
          </li>
        ))}
      </ul>
      <details className="mt-4 border-t border-board-line py-3">
        <summary className="font-semibold">Add a resume</summary>
        <form
          onSubmit={reference}
          className="grid items-end gap-4 sm:grid-cols-2"
        >
          <Field label="Variant">
            <select name="name" className={control}>
              {variants.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Resume link">
            <input
              name="url"
              className={control}
              type="url"
              placeholder="https://…"
              required
            />
          </Field>
          <button className={secondary}>Add reference</button>
        </form>
        <form
          onSubmit={upload}
          className="mt-7 grid items-end gap-4 border-t border-board-line pt-6 sm:grid-cols-2"
        >
          <Field label="Private resume file (PDF or DOCX, up to 10 MB)">
            <input
              className={control}
              type="file"
              name="file"
              accept=".pdf,.docx"
              required
              disabled={!w.user || busy}
            />
          </Field>
          <Field label="File variant">
            <select className={control} name="variant">
              {variants.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <button className={primary} disabled={!w.user || busy}>
            {busy ? "Uploading…" : "Upload private resume"}
          </button>
        </form>
        {!w.user && (
          <Notice>
            Sign in to upload private resume files. You can save references in
            this browser.
          </Notice>
        )}
      </details>
      <Notice>{feedback}</Notice>
    </Section>
  );
}
