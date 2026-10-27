"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { control, Field } from "./ui";
import type { Role } from "./role-card";
import ProfileIcon from "./profile-icon";
import { applicationReviewQuestions, applicationReviewSummary, applicationReviewGroups } from "../../lib/application-review.mjs";
import styles from "./discover-role-panel.module.css";
type Question = { question: string; answer?: string; reason?: string; required?: boolean };
export default function RoleApplicationPreview({ role }: { role: Role }) {
  const w = useWorkspace();
  const draft = w.state.workflow.applications[role.id];
  // Rendering never grants reuse permission or changes backend review state.
  const source = w.demo && role.reviewPreview ? role.reviewPreview : draft?.questions || [];
  const groups = applicationReviewGroups(source, draft?.questionsReviewed === true);
  const questions: Question[] = groups.human;
  const optionalLabels = [...new Set(groups.optional.map((q:Question)=>q.question))];
  const summary = applicationReviewSummary(source, draft?.questionsReviewed === true);
  const checkedAt = draft?.inspectedAt && Number.isFinite(Date.parse(draft.inspectedAt)) ? new Date(draft.inspectedAt).toLocaleString() : null;
  if (!draft && applicationReviewQuestions(source).length === 0) return null;
  return <section aria-labelledby="application-preview" className={styles.application}>
    <div className="mb-2 flex items-center justify-between gap-3"><h3 id="application-preview" className="text-lg font-semibold">Application review</h3><span className={styles.reviewCount}>{`${groups.human.length} need your input`}</span></div>
    <p className="mb-2 text-sm text-board-muted">{summary.filled} saved answers filled. {groups.human.length} need your input; {groups.agent.length} await agent drafting.</p>
    {checkedAt && <p className="mb-2 text-xs text-board-muted">Form checked {checkedAt}. Conditional fields still need browser review.</p>}
    <p className="mb-5 text-sm text-board-muted">Only missing required answers and generated answers awaiting your review appear here.</p>
    {questions.map((question, index) => <div key={`${question.question}-${index}`} className={styles.reviewQuestion}>
      <div className="mb-2 flex items-start gap-2 text-board-warning"><ProfileIcon name="conversation" className="mt-0.5 shrink-0" width={18} height={18} /><span className="text-sm font-semibold">{question.answer?.trim() ? "Review this answer" : question.required === false ? "Optional answer" : "Your answer needed"}</span></div>
      <Field label={question.question}><textarea aria-label={question.question} className={`${control} min-h-24`} defaultValue={question.answer || ""} placeholder="Write your answer" /></Field>
      <p className="mt-2 text-xs leading-relaxed text-board-muted">{question.reason || "This answer is missing from your saved profile or needs your review."}</p>
    </div>)}
    {groups.agent.length > 0 && <div className="mt-5 text-sm"><h4 className="font-semibold">Agent drafting pending</h4><ul className="mt-2 list-disc pl-5 text-board-muted">{groups.agent.map((q:Question,index:number)=><li key={index}>{q.question}</li>)}</ul></div>}
    {groups.optional.length > 0 && <details className="mt-5 border-t border-board-line pt-3"><summary className="cursor-pointer text-sm font-semibold">Optional fields ({optionalLabels.length}) · not blocking</summary><p className="mt-2 text-xs text-board-muted">These may be left blank. Cover-letter upload and text are alternatives. Sensitive personal choices are never inferred.</p><ul className="mt-2 list-disc pl-5 text-sm text-board-muted">{optionalLabels.map((label,index)=><li key={index}>{label}</li>)}</ul></details>}
    {groups.browser.length > 0 && <p className="mt-4 text-sm text-board-muted">{groups.browser.length} employer controls need browser inspection or explicit consent.</p>}
    <p className="mt-5 text-xs leading-relaxed text-board-muted">{w.demo ? "Fictional review example. " : "Based on recorded draft questions; the live employer form may include more. "}Edits last only until you close this preview. Nothing is approved or submitted.</p>
    {draft && <Link href="/applications/" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-board-accent">Open saved draft in Applications<ProfileIcon name="arrow" width={16} height={16} /></Link>}
  </section>;
}
