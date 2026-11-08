"use client";
import Link from "next/link";
import ApplicationFitAssessment from "./application-fit-assessment";
import {EXTRA_FEATURES_ENABLED} from "../../lib/feature-scope.mjs";
import JobDescription from "./job-description";
import InterviewIntelligence from "./interview-intelligence";
import type { Role } from "./role-card";
import type { Application } from "./workflow-types";
import RoleJobFacts from "./role-job-facts";
import ProfileIcon from "./profile-icon";
import { secondary } from "./ui";
import { trackerProgress } from "../../lib/tracker-display.mjs";
type TrackerItem = { status?: string; openedDate?: string; appliedDate?: string };
export default function ApplicationOverview({ application, role, workflow, item, uncertain, preparing, demo, onDocuments, onPreparation }: {
  application: Application; role?: Role; workflow?: Application; item: TrackerItem;
  uncertain: boolean; preparing: boolean; demo: boolean; onDocuments: () => void; onPreparation: () => void;
}) {
  const stage = trackerProgress(application, item).status;
  const facts: Role = {
    employmentType: application.employmentType || "N/A", location: application.location || "N/A",
    category: "N/A", priority: "", discoveredDate: "", sourceFreshness: "Not recorded", whyItFits: "", applicationUrl: "",
    ...application, ...role,
  };
  const draftNeedsReview = Boolean(preparing && workflow && !workflow.questionsReviewed);
  const needsResume = Boolean(preparing && workflow && !workflow.resumeId && !workflow.submittedResume);
  const blocked = workflow?.status === "Blocked";
  const attention = blocked || uncertain || Boolean(application.blocker) || draftNeedsReview || needsResume;
  const url = application.url || application.applicationUrl;
  const attentionContent = (
    <section className={`application-overview-attention ${attention ? "has-attention" : ""}`} aria-labelledby="overview-attention">
      <h3 id="overview-attention"><ProfileIcon name={attention ? "shield" : "check"} />Needs attention</h3>
      {uncertain && <p className="application-overview-urgent">Submission outcome is uncertain. Check the employer confirmation before considering a retry.</p>}
      {blocked && !application.blocker && !uncertain && <p>Preparation is blocked; no reason has been recorded yet.</p>}
      {application.blocker && <p className="application-overview-urgent">{application.blocker}</p>}
      {(draftNeedsReview || needsResume) && <ul>
        {draftNeedsReview && <li>{workflow?.questions?.length ? `${workflow.questions?.length} recorded employer question${workflow.questions?.length === 1 ? "" : "s"} in an unreviewed list.` : "The employer question list has not been reviewed."}</li>}
        {needsResume && <li>No resume is selected for this draft.</li>}
      </ul>}
      <button className={`${secondary} mt-3 gap-2`} onClick={onDocuments}>{attention ? "Review in Documents" : "View documents & evidence"}<ProfileIcon name="arrow" width={16} height={16} /></button>
    </section>
  );
  return <section className="application-overview" aria-label="Application overview">
    <div className="application-overview-snapshot">
      <div className="application-overview-heading"><h3>At a glance</h3><span className="application-overview-stage"><ProfileIcon name="briefcase" width={16} height={16} />{stage}</span></div>
      <dl className="application-overview-records">
        <div><dt><ProfileIcon name="clock" width={17} height={17} />Opened</dt><dd>{item.openedDate || "N/A"}</dd></div>
        {item.appliedDate && <div><dt><ProfileIcon name="send" width={17} height={17} />Applied date</dt><dd>{item.appliedDate}</dd></div>}
      </dl>
    </div>
    {attention && attentionContent}
    <ApplicationFitAssessment assessment={demo?facts.matchPreview||facts.matchAssessment:facts.matchAssessment}/>
    <div className="application-overview-facts"><h3>Job details</h3><RoleJobFacts role={facts} unrecorded={Boolean(application.imported)} />
      {!demo && url ? <a className="application-overview-posting" href={url} target="_blank" rel="noopener noreferrer">View job posting<ProfileIcon name="arrow" width={17} height={17} /></a> : <p className="application-overview-caption">{demo ? "Fictional demo listing" : "Posting URL not recorded"}</p>}
    </div>
    <section className="application-overview-attention"><h3>Current prep</h3><div className="mt-3 flex flex-wrap gap-3"><button className={secondary} onClick={onPreparation}>Interview brief</button><Link className={secondary} href="/career-toolkit/#workspace">Toolkit workspace</Link></div></section>
    {facts.whyItFits&&<details className="application-overview-context"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Fit notes</summary><p>{facts.whyItFits}</p></details>}
    {EXTRA_FEATURES_ENABLED && !application.imported && <InterviewIntelligence jobId={application.id} applicationId={application.backendId}/> }
    <details className="application-overview-description"><summary><h3>Job Description</h3><ProfileIcon name="chevron" width={18} height={18} /></summary><JobDescription description={facts.description} url={url || facts.applicationUrl} demo={demo} /></details>
  </section>;
}
