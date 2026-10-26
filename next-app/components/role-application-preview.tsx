"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { control, Field } from "./ui";
import type { Role } from "./role-card";
import ProfileIcon from "./profile-icon";
import { applicationReviewQuestions } from "../../lib/application-review.mjs";
import styles from "./discover-role-panel.module.css";
type Question = { question: string; answer?: string; reason?: string; required?: boolean };
export default function RoleApplicationPreview({ role }: { role: Role }) {
  const w = useWorkspace();
  const draft = w.state.workflow.applications[role.id];
  // Rendering never grants reuse permission or changes backend review state.
  const source = w.demo && role.reviewPreview ? role.reviewPreview : draft?.questions || [];
  const questions: Question[] = applicationReviewQuestions(source, draft?.questionsReviewed === true);
  if (questions.length === 0) return null;
  const count = questions.length;
  return <section aria-labelledby="application-preview" className={styles.application}>
    <div className="mb-2 flex items-center justify-between gap-3"><h3 id="application-preview" className="text-lg font-semibold">Application review</h3><span className={styles.reviewCount}>{count ? `${count} to review` : "No recorded blockers"}</span></div>
    <p className="mb-5 text-sm text-board-muted">Only recorded questions that need your input or a custom answer review.</p>
    {questions.map((question, index) => <div key={`${question.question}-${index}`} className={styles.reviewQuestion}>
      <div className="mb-2 flex items-start gap-2 text-board-warning"><ProfileIcon name="conversation" className="mt-0.5 shrink-0" width={18} height={18} /><span className="text-sm font-semibold">{question.answer?.trim() ? "Review this answer" : question.required === false ? "Optional answer" : "Your answer needed"}</span></div>
      <Field label={question.question}><textarea aria-label={question.question} className={`${control} min-h-24`} defaultValue={question.answer || ""} placeholder="Write your answer" /></Field>
      <p className="mt-2 text-xs leading-relaxed text-board-muted">{question.reason || "This recorded employer question has not been reviewed."}</p>
    </div>)}
    <p className="mt-5 text-xs leading-relaxed text-board-muted">{w.demo ? "Fictional review example. " : "Based on recorded draft questions; the live employer form may include more. "}Edits last only until you close this preview. Nothing is approved or submitted.</p>
    {draft && <Link href="/applications/" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-board-accent">Open saved draft in Applications<ProfileIcon name="arrow" width={16} height={16} /></Link>}
  </section>;
}
