"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { control, Field } from "./ui";
import type { Role } from "./role-card";
import ProfileIcon from "./profile-icon";
import styles from "./discover-role-panel.module.css";
type Question = { question: string; answer?: string; reason?: string };
export default function RoleApplicationPreview({ role }: { role: Role }) {
  const w = useWorkspace();
  const profile = w.state.workflow.profile || {};
  const draft = w.state.workflow.applications[role.id];
  const contacts = [
    { label: "Name", value: profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" "), type: "text" },
    { label: "Email", value: profile.email || "", type: "email" },
    { label: "Phone", value: profile.phone || "", type: "tel" },
    { label: "Location", value: profile.location || "", type: "text" },
  ];
  const missing = contacts.filter(field => !field.value.trim());
  const saved = contacts.filter(field => field.value.trim());
  // This UI never grants reuse permission or changes backend review state.
  const questions: Question[] = w.demo && role.reviewPreview ? role.reviewPreview : draft?.questionsReviewed === true ? [] : draft?.questions || [];
  const needsContactReview = saved.length > 0 && profile.verified !== true;
  const count = missing.length + questions.length + (needsContactReview ? 1 : 0);
  const input = (field: typeof contacts[number]) => <Field key={field.label} label={field.label}><input className={control} type={field.type} autoComplete="off" defaultValue={field.value} placeholder={`Add your ${field.label.toLowerCase()}`} /></Field>;
  return <section aria-labelledby="application-preview" className={styles.application}>
    <div className="mb-2 flex items-center justify-between gap-3"><h3 id="application-preview" className="text-lg font-semibold">Application review</h3><span className={styles.reviewCount}>{count ? `${count} to review` : "No recorded blockers"}</span></div>
    <p className="mb-5 text-sm text-board-muted">Only the decisions that need you. Saved details stay tucked away.</p>
    <div className="mb-4 flex items-center gap-2 text-sm text-board-success"><ProfileIcon name="file" width={18} height={18} /><span>{saved.length} contact details from your profile</span></div>
    {missing.length > 0 && <div className="mb-5"><h4 className="mb-3 text-sm font-semibold">Missing contact information</h4><div className="grid gap-4 sm:grid-cols-2">{missing.map(input)}</div></div>}
    {questions.map((question, index) => <div key={`${question.question}-${index}`} className={styles.reviewQuestion}>
      <div className="mb-2 flex items-start gap-2 text-board-warning"><ProfileIcon name="conversation" className="mt-0.5 shrink-0" width={18} height={18} /><span className="text-sm font-semibold">{question.answer?.trim() ? "Review this answer" : "Your answer needed"}</span></div>
      <Field label={question.question}><textarea className={`${control} min-h-24`} defaultValue={question.answer || ""} placeholder="Write your answer" /></Field>
      <p className="mt-2 text-xs leading-relaxed text-board-muted">{question.reason || "This recorded employer question has not been reviewed."}</p>
    </div>)}
    {saved.length > 0 && <details className="mt-4 border-t border-board-line/60 pt-2"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm"><span>{needsContactReview ? "Confirm saved contact details" : "View saved contact details"}</span><span className={needsContactReview ? "text-xs text-board-warning" : "text-xs text-board-success"}>{needsContactReview ? "Not verified" : "Saved"}</span></summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{saved.map(input)}</div></details>}
    <p className="mt-5 text-xs leading-relaxed text-board-muted">{w.demo ? "Fictional review example. " : "Employer form not loaded; more questions may appear. "}Edits last only until you close this preview. Nothing is approved or submitted.</p>
    {draft && <Link href="/applications/" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-board-accent">Open saved draft in Applications<ProfileIcon name="arrow" width={16} height={16} /></Link>}
  </section>;
}
