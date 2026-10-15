"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading } from "./ui";
import { useState } from "react";
import DraftReview from "./draft-review";
import NeedsYouRow, { ActionCheck } from "./needs-you-row";
import DemoNeedsYou from "./demo-needs-you";
import PreparationReminders from "./preparation-reminders";
import type { Application } from "./workflow-types";
export default function NeedsYou() {
  const w = useWorkspace();
  const [review, setReview] = useState<string | null>(null);
  const setup =
    !w.state.workflow.profile.verified || !w.state.workflow.resumes.length;
  const apps = Object.values(w.state.workflow.applications as Record<string, Application>).filter(
    (d) =>
      d.status === "Awaiting approval" ||
      d.status === "Blocked" ||
      (w.models.workflowModel.canEdit(d) &&
        (d.submissionAttempts || []).some(
          (t) =>
            t.state === "uncertain" ||
            (t.state === "started" &&
              Date.parse(t.startedAt) < Date.now() - 300000),
        )),
  );
  if (w.demo) return <DemoNeedsYou />;
  const handoffCount = apps.length + (setup ? 1 : 0);
  return (
    <>
      <Heading title="Action Board">
        Your decisions, manual steps, and deadline-driven preparation in one place. Finish an item and it clears from the board.
      </Heading>
      <div className="action-board-layout grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <section className="glass-panel action-widget min-w-0 rounded-2xl p-5 md:p-6" aria-labelledby="checklist-heading">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="checklist-heading" className="text-lg font-bold">Your checklist</h2><p className="mt-1 text-sm leading-relaxed text-board-muted">Items that need a human decision or handoff.</p></div>
            <span className="action-widget-count rounded-md px-2 py-1 text-xs font-semibold tabular-nums">{handoffCount}</span>
          </div>
          {handoffCount ? <ul className="mt-3 divide-y divide-board-line">
            {setup && <NeedsYouRow title="Set up your application profile" context="Profile and résumé" reason="Verify your factual answers and add a résumé before Muse prepares applications." control={<Link href="/profile/" className="action-check" aria-label="Open profile setup" />} />}
            {apps.map(application => {
              const uncertain = (application.submissionAttempts || []).some(attempt => attempt.state === "uncertain" || (attempt.state === "started" && Date.parse(attempt.startedAt) < Date.now() - 300000));
              const title = uncertain ? "Check whether an application submitted" : application.status === "Blocked" ? "Resolve an application blocker" : "Review an application";
              const reason = uncertain ? "Verify the employer portal or confirmation email before allowing another attempt." : application.blocker || "Your approval is required before this application can proceed.";
              const tracked = w.state.tracker.items[application.id] || {};
              const date = tracked.appliedDate || tracked.openedDate;
              const dateLabel = date ? `${tracked.appliedDate ? "Applied" : "Opened"} ${new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(date.length === 10 ? { timeZone: "UTC" } : {}) })}` : "Date not recorded";
              return <NeedsYouRow key={application.id} title={title} context={`${application.company} · ${application.title}`} reason={reason} role={{company:application.company,roleTitle:application.title,roleType:application.employmentType === "FT" ? "Full-time" : application.employmentType || "Type not recorded",date:dateLabel,status:tracked.status || "New",workflow:application.status}} control={<ActionCheck label={uncertain ? `Verify submission for ${application.company}` : `${title} for ${application.company}`} onClick={() => setReview(application.id)} disabled={w.locked} />} />;
            })}
          </ul> : <div className="py-12 text-center"><svg aria-hidden="true" className="mx-auto text-board-success" width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M7 16.5 13 22l12-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="3" width="26" height="26" rx="8" stroke="currentColor" strokeWidth="1.5"/></svg><h3 className="mt-4 font-bold">Human handoffs are clear</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-board-muted">Muse can keep working without a decision from you right now.</p></div>}
        </section>
        <PreparationReminders />
      </div>
      {review && <DraftReview key={review} id={review} onClose={() => setReview(null)} />}
    </>
  );
}
