"use client";
import { buildSubmissionRecord } from "../../submission-record.mjs";
import { secondary } from "./ui";

function timestamp(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}
function answer(value) {
  if (value === null || value === undefined) return "No answer recorded";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
function Confirmation({ receipt }) {
  return <div className="mt-4 text-sm leading-relaxed">
    <h4 className="font-semibold">Observed employer confirmation</h4>
    <p className="mt-2 whitespace-pre-wrap break-words">{receipt.message}</p>
    <p className="mt-2 break-all text-board-muted">Source: {receipt.source}</p>
    {receipt.observedUrl && <p className="mt-1 break-all text-board-muted">Observed page: {receipt.observedUrl}</p>}
  </div>;
}

export default function SubmissionRecord({ application, attempts = [], loading = false, error = "", onDownloadResume }) {
  const record = buildSubmissionRecord(application, attempts);
  return <section className="mt-4 min-w-0 border-t border-board-line pt-4" aria-label="Submission record">
    <h3 className="font-semibold">Submission record</h3>
    {loading ? <p role="status" className="mt-2 text-sm text-board-muted">Loading submission evidence…</p>
      : error ? <p role="alert" className="mt-2 text-sm text-board-muted">Submission evidence could not load. {error}</p>
        : <>
          {record.userReported && <p className="mt-2 text-sm text-board-muted">Reported submitted by you · {timestamp(record.submittedAt)}. Muse has no observed employer confirmation for this record.</p>}
          {record.legacyReceipt && <><Confirmation receipt={record.legacyReceipt} /><p className="mt-2 text-sm text-board-muted">Recorded submission: {timestamp(record.submittedAt)}. No matching attempt snapshot is available here.</p></>}
          {!record.attempts.length && !record.legacyReceipt && !record.userReported && <p className="mt-2 text-sm text-board-muted">No submission attempt has been recorded.</p>}
          <ol className="mt-3 divide-y divide-board-line">
            {record.attempts.map(attempt => <li key={attempt.id} className="py-4">
              <div className="mb-2 text-sm">
                <p className="font-semibold">{attempt.resume ? `Résumé used: ${attempt.resume.name}` : 'Résumé used: snapshot unavailable'}</p>
                {attempt.resume && <p className="mt-1 text-board-muted">{attempt.resume.version !== null && attempt.resume.version !== '' ? `Version ${attempt.resume.version}` : 'Version not recorded'}{attempt.resume.variant ? ` · ${attempt.resume.variant}` : ''} · {attempt.label}</p>}
              </div>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{attempt.label} · {timestamp(attempt.createdAt)}</summary>
                <div className="mt-3 space-y-3 text-sm leading-relaxed">
                  <p className="text-board-muted">Revision {attempt.revision} · Started: {timestamp(attempt.startedAt)} · Finished: {timestamp(attempt.finishedAt)}</p>
                  <p className="break-all text-xs text-board-muted">Attempt: {attempt.id}</p>
                  {attempt.receipt && <Confirmation receipt={attempt.receipt} />}
                  <h4 className="font-semibold">Résumé pinned for this attempt</h4>
                  {attempt.resume ? <div><p>{attempt.resume.name}</p><p className="mt-1 text-board-muted">{attempt.resume.version !== null && attempt.resume.version !== '' ? `Version ${attempt.resume.version}` : 'Version not recorded'}{attempt.resume.variant ? ` · ${attempt.resume.variant}` : ''}</p><p className="mt-1 break-all text-xs text-board-muted">SHA-256: {attempt.resume.sha256 || "Not recorded"}</p>{onDownloadResume && attempt.resume.objectPath && <button className={`${secondary} mt-3`} onClick={() => onDownloadResume(attempt.resume)}>Download saved résumé</button>}</div> : <p className="text-board-muted">No résumé snapshot available.</p>}
                  <h4 className="pt-2 font-semibold">Answers pinned for this attempt</h4>
                  <p className="text-board-muted">These are the saved materials at execution time. Employer confirmation verifies the submission outcome; it does not independently verify every field.</p>
                  {attempt.questions.length ? <dl className="space-y-4">{attempt.questions.map((q, index) => <div key={index}><dt className="font-medium">{q.question}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-board-muted">{q.fieldType === "file" && q.answer === attempt.resume?.id ? attempt.resume.name : answer(q.answer)}</dd></div>)}</dl> : <p className="text-board-muted">No answer snapshot available.</p>}
                </div>
              </details>
            </li>)}
          </ol>
        </>}
  </section>;
}
