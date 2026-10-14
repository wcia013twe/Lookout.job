"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading, Empty, primary } from "./ui";
import ApplicationList from "./application-list";
import type { Application } from "./workflow-types";
export default function NeedsYou() {
  const w = useWorkspace();
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
      {!!apps.length && <ApplicationList items={apps} />}
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
