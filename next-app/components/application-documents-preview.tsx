"use client";
import { useState } from "react";
import { buildSubmissionRecord } from "../../lib/submission-record.mjs";
import type { Application, SavedResume } from "./workflow-types";
import ProfileIcon from "./profile-icon";
import { control, secondary } from "./ui";
type Profile = Record<string, unknown>;
type PreviewQuestion = { question: string; answer: unknown; fieldType?: string | null };
const display = (value: unknown): string => value == null || value === "" ? "Not recorded" : typeof value === "boolean" ? value ? "Yes" : "No" : Array.isArray(value) ? value.map(display).join(", ") : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
export default function ApplicationDocumentsPreview({ application, draft, profile, resume, hasDraft, recordApplication, attempts, loading, error, onRetry, onDownloadResume }: {
  application: Application; draft: Application; profile: Profile; resume?: SavedResume; hasDraft: boolean;
  recordApplication?: Partial<Application>; attempts: Record<string, unknown>[]; loading: boolean; error: string; onRetry: () => void; onDownloadResume?: (resume: SavedResume) => void | Promise<void>;
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const record = buildSubmissionRecord(recordApplication || { ...application, id: application.backendId || application.id }, attempts);
  const snapshots = record.attempts.filter(attempt => attempt.hasSnapshot);
  const historical = ["Submitted", "Interview", "Offer", "Rejected", "Withdrawn"].includes(application.status);
  const preferred = snapshots[0];
  const source = selection ?? (historical && preferred ? preferred.id : "draft");
  const snapshot = snapshots.find(attempt => attempt.id === source);
  const questions: PreviewQuestion[] = snapshot ? snapshot.questions : draft.questions || [];
  const chosenResume = snapshot ? snapshot.resume : resume || application.submittedResume;
  const answered = questions.filter(question => question.answer != null && String(question.answer).trim()).length;
  const contacts = [
    ["Full name", profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" ")],
    ["Email", profile.email], ["Phone", profile.phone], ["Location", profile.location],
    ...[ ["LinkedIn", profile.linkedin], ["GitHub", profile.github], ["Portfolio", profile.portfolio], ["Work authorization", profile.authorization] ].filter(([, value]) => Boolean(value)),
  ];
  return <section className="application-form-preview" aria-label="Complete application preview">
    <div className="application-form-heading"><div><h3>Application preview</h3><p>{snapshot ? "Saved materials for this attempt" : hasDraft ? "Current draft and profile reference" : "Application has not been prepared"}</p></div><span className={`application-form-badge ${snapshot?.confirmed ? "is-confirmed" : ""}`}>{snapshot ? snapshot.label : "Draft view"}</span></div>
    {snapshots.length > 0 && <label className="mb-5 block text-sm text-board-muted">Preview source<select className={`${control} mt-2`} aria-label="Application preview source" value={source} onChange={event => setSelection(event.target.value)}><option value="draft">Current draft · current profile</option>{snapshots.map(attempt => <option key={attempt.id} value={attempt.id}>{attempt.label} · revision {attempt.revision}{attempt.createdAt ? ` · ${attempt.createdAt.slice(0, 10)}` : ""}</option>)}</select></label>}
    {loading && <p className="application-form-notice" role="status">Loading saved submission materials…</p>}
    {error && <div className="application-form-notice" role="alert"><p>Saved submission materials could not load. The draft view below is not submission evidence.</p><button className={`${secondary} mt-3`} onClick={onRetry}>Retry saved materials</button></div>}
    {historical && !snapshot && !loading && !error && <p className="application-form-caption">No saved attempt snapshot is available here. Showing the current draft reference.</p>}
    <div className="application-form-notice">{snapshot ? "Exact fields saved for this attempt. Employer confirmation does not independently verify every answer." : "Recorded draft answers plus your current profile reference. These details do not prove what was sent."}</div>
    <div className="application-form-material"><ProfileIcon name="file" className="shrink-0 text-board-accent" /><div><h4>{chosenResume?.name || "No resume recorded"}</h4><p>{chosenResume?.version ? `Version ${chosenResume.version}` : "Version not recorded"}{snapshot ? " · Pinned to this attempt" : resume ? " · Selected for this draft" : application.submittedResume ? " · Recorded submitted resume metadata" : ""}</p>{snapshot?.resume?.objectPath && onDownloadResume && <button className={`${secondary} mt-3`} onClick={() => onDownloadResume(snapshot.resume!)}>Download recorded resume</button>}</div></div>
    {!snapshot && <section className="application-form-section" aria-labelledby="application-contact"><h4 id="application-contact"><ProfileIcon name="user" />Profile reference</h4><p className="application-form-caption">Current account details · not mapped employer fields{profile.verified !== true ? " · not verified" : ""}</p><dl className="application-form-fields">{contacts.map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd className={!value ? "is-missing" : ""}>{display(value)}</dd></div>)}</dl>
      {Boolean(profile.headline || profile.skills) && <dl className="application-form-fields mt-5">{Boolean(profile.headline) && <div><dt>Professional headline</dt><dd>{display(profile.headline)}</dd></div>}{Boolean(profile.skills) && <div><dt>Skills</dt><dd>{display(profile.skills)}</dd></div>}</dl>}
      {([ ["Work experience", "workExperience"], ["Education", "education"], ["Projects", "projects"] ] as const).map(([label, key]) => {
        const entries = Array.isArray(profile[key]) ? profile[key] as Record<string, unknown>[] : [];
        return entries.length > 0 && <section key={key} className="application-form-background"><h5>{label}</h5>{entries.map((entry, index) => <dl className="application-form-fields" key={index}>{Object.entries(entry).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([field, value]) => <div key={field}><dt>{field.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase())}</dt><dd>{display(value)}</dd></div>)}</dl>)}</section>;
      })}
    </section>}
    <section className="application-form-section" aria-labelledby="application-answers"><div className="application-form-heading"><h4 id="application-answers"><ProfileIcon name="conversation" />{snapshot ? "Captured application fields" : "Employer questions & answers"}</h4><span className={`application-form-badge ${questions.length > 0 && answered === questions.length ? "is-complete" : ""}`}>{questions.length ? `${answered}/${questions.length} filled` : "No fields recorded"}</span></div>
      {questions.length ? <dl className="application-form-answers">{questions.map((question, index) => <div key={index}><dt><span>{question.question || "Untitled employer question"}</span>{!String(question.answer ?? "").trim() && <span className="text-xs text-board-warning">Answer needed</span>}</dt><dd className={!String(question.answer ?? "").trim() ? "is-missing" : ""}>{("fieldType" in question && question.fieldType === "file" && question.answer === snapshot?.resume?.id) ? snapshot?.resume?.name || "Saved resume" : question.answer == null || !String(question.answer).trim() ? "No answer recorded" : display(question.answer)}</dd></div>)}</dl> : <p className="application-form-notice">{snapshot ? "No field answers were captured in this attempt snapshot." : "No employer questions have been recorded. This does not establish that the employer form has no questions."}</p>}
      {!snapshot && <p className="application-form-caption">{draft.questionsReviewed ? "Question-list review recorded for this draft." : "The employer question list still needs review."} Saving or viewing this preview does not submit an application.</p>}
    </section>
  </section>;
}
