"use client";
import type { Role } from "./role-card";
import type { Application } from "./workflow-types";
import RoleJobFacts from "./role-job-facts";
import ProfileIcon from "./profile-icon";
import { secondary } from "./ui";
import { trackerProgress } from "../../lib/tracker-display.mjs";
type TrackerItem = { status?: string; openedDate?: string; appliedDate?: string };
export default function ApplicationOverview({ application, role, workflow, item, uncertain, preparing, demo, onDocuments }: {
  application: Application; role?: Role; workflow?: Application; item: TrackerItem;
  uncertain: boolean; preparing: boolean; demo: boolean; onDocuments: () => void;
}) {
  const stage = trackerProgress(application, item).status;
  const facts: Role = {
    employmentType: application.employmentType || "Type not recorded", location: application.location || "Location not recorded",
    category: "Not recorded", priority: "", discoveredDate: "", sourceFreshness: "Not recorded", whyItFits: "", applicationUrl: "",
    ...application, ...role,
  };
  const draftNeedsReview = Boolean(preparing && workflow && !workflow.questionsReviewed);
  const needsResume = Boolean(preparing && workflow && !workflow.resumeId && !workflow.submittedResume);
  const blocked = workflow?.status === "Blocked";
  const attention = blocked || uncertain || Boolean(application.blocker) || draftNeedsReview || needsResume;
  const url = application.url || application.applicationUrl;
  const attentionContent = (
    <section className={`application-overview-attention ${attention ? "has-attention" : ""}`} aria-labelledby="overview-attention">
      <h3 id="overview-attention"><ProfileIcon name={attention ? "shield" : "check"} />{attention ? "Needs attention" : "Current preparation"}</h3>
      {uncertain && <p className="application-overview-urgent">Submission outcome is uncertain. Check the employer confirmation before considering a retry.</p>}
      {blocked && !application.blocker && !uncertain && <p>Preparation is blocked; no reason has been recorded yet.</p>}
      {application.blocker && <p className="application-overview-urgent">{application.blocker}</p>}
      {(draftNeedsReview || needsResume) && <ul>
        {draftNeedsReview && <li>{workflow?.questions?.length ? `${workflow.questions?.length} recorded employer question${workflow.questions?.length === 1 ? "" : "s"} in an unreviewed list.` : "The employer question list has not been reviewed."}</li>}
        {needsResume && <li>No resume is selected for this draft.</li>}
      </ul>}
      {!workflow && <p>No application draft has been prepared for this saved role.</p>}
      {workflow && !attention && <p>No blocker is recorded. Check Documents for the draft and submission evidence.</p>}
      <button className={`${secondary} mt-3 gap-2`} onClick={onDocuments}>{attention ? "Review in Documents" : "View documents & evidence"}<ProfileIcon name="arrow" width={16} height={16} /></button>
    </section>
  );
  return <section className="application-overview" aria-label="Application overview">
    <div className="application-overview-snapshot">
      <div className="application-overview-heading"><h3>At a glance</h3><span className="application-overview-stage"><ProfileIcon name="briefcase" width={16} height={16} />{stage}</span></div>
      <p className="application-overview-caption">Recorded progress and preparation are tracked separately.</p>
      <dl className="application-overview-records">
        <div><dt><ProfileIcon name="file" width={17} height={17} />Preparation</dt><dd>{workflow?.status || "Opened — not queued"}</dd></div>
        <div><dt><ProfileIcon name="clock" width={17} height={17} />Opened</dt><dd>{item.openedDate || "Not recorded"}</dd></div>
        {item.appliedDate && <div><dt><ProfileIcon name="send" width={17} height={17} />Applied date</dt><dd>{item.appliedDate}</dd></div>}
      </dl>
    </div>
    {attention && attentionContent}
    <div className="application-overview-facts"><h3>Job details</h3><RoleJobFacts role={facts} />
      {!demo && url ? <a className="application-overview-posting" href={url} target="_blank" rel="noopener noreferrer">View job posting<ProfileIcon name="arrow" width={17} height={17} /></a> : <p className="application-overview-caption">{demo ? "Fictional demo listing" : "Posting URL not recorded"}</p>}
    </div>
    {!attention && attentionContent}
    <section className="application-overview-context" aria-labelledby="overview-context">
      <h3 id="overview-context"><ProfileIcon name="sliders" />Fit & context</h3>
      <p>{facts.whyItFits || "No role-fit research has been recorded for this application."}</p>
      <small>Collected research notes · not a new AI assessment</small>
    </section>
    <details className="application-overview-description"><summary><h3>About the job</h3><ProfileIcon name="chevron" width={18} height={18} /></summary><p>{facts.description || "The full employer description has not been collected. Use the job posting to verify the current responsibilities and requirements."}</p></details>
  </section>;
}
