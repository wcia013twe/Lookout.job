"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading, Empty, primary } from "./ui";
import { useState } from "react";
import DraftReview from "./draft-review";
import NeedsYouRow from "./needs-you-row";
import DemoNeedsYou from "./demo-needs-you";
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
  return (
    <>
      <Heading title="Needs you">
        Review answers, resolve blockers, and verify uncertain submission
        outcomes.
      </Heading>
      {setup && (
        <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div>
            <h2 className="font-bold">Set up your application profile</h2>
            <p className="mt-2 text-sm text-board-muted">
              Verify your factual answers and add a resume.
            </p>
          </div>
          <Link href="/profile/" className={primary}>
            Set up
          </Link>
        </div>
      )}
      {!!apps.length && <ul className="divide-y divide-board-line">
        {apps.map(application => {
          const uncertain = (application.submissionAttempts || []).some(attempt => attempt.state === "uncertain" || (attempt.state === "started" && Date.parse(attempt.startedAt) < Date.now() - 300000));
          const title = uncertain ? "Check whether an application submitted" : application.status === "Blocked" ? "Resolve an application blocker" : "Review an application";
          const reason = uncertain ? "Verify the employer portal or confirmation email before allowing another attempt." : application.blocker || "Your approval is required before this application can proceed.";
          return <NeedsYouRow key={application.id} title={title} context={`${application.company} · ${application.title}`} reason={reason}>
            <button type="button" className={primary} onClick={() => setReview(application.id)}>{uncertain ? "Verify submission" : application.status === "Blocked" ? "Resolve blocker" : "Review application"}</button>
          </NeedsYouRow>;
        })}
      </ul>}
      {review && <DraftReview key={review} id={review} onClose={() => setReview(null)} />}
      {!apps.length && !setup && (
        <Empty
          title="Nothing needs your attention"
          href="/"
          action="Discover roles"
        >
          Your drafts and progress are available in Applications.
        </Empty>
      )}
    </>
  );
}
