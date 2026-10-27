"use client";
import {recommendationNeedsRefresh} from "../../lib/job-assessment.mjs";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../lib/workspace";
import { primary, secondary } from "./ui";
import { CompanyLogo, type Role } from "./role-card";
import RoleMatchPreview from "./role-match-preview";
import RoleJobFacts from "./role-job-facts";
import RoleApplicationPreview from "./role-application-preview";
import ProfileIcon from "./profile-icon";
import { companyRanking } from "../lib/role-display";
import { recordRoleOpened } from "../lib/progress.mjs";
import styles from "./discover-role-panel.module.css";
export default function DiscoverRolePanel({ role, onClose, assessmentPending=false }: { role: Role; onClose: () => void; assessmentPending?:boolean }) {
  const w = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const sample = w.demo ? role.matchPreview : role.matchAssessment;
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={styles.panel} aria-labelledby="discover-role-heading" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="sticky top-0 z-10 border-b border-board-line bg-board-panel px-5 py-4 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo company={role.company} />
          <div><p className="text-sm text-board-muted">{role.company} · {companyRanking(role.company, role.employmentType, w.state.workflow, role.rankingProfile || role.searchProfileId).label}</p><h2 id="discover-role-heading" className="mt-1 break-words text-xl font-semibold tracking-tight">{role.title}</h2></div>
        </div>
        <button className={`${secondary} shrink-0`} onClick={onClose} aria-label="Close job preview">Close</button>
      </div>
    </header>
    <div className="space-y-7 px-5 py-6 sm:px-8">
      {recommendationNeedsRefresh(role,w.state.workflow.searchPreferences.profiles || []) && <p role="status" className="rounded-lg border border-board-warning/40 p-3 text-sm text-board-warning">Your preferences changed since this analysis. Ask Muse to refresh these recommendations.</p>}
      <RoleJobFacts role={role} />
      <div className={styles.match}><RoleMatchPreview sample={sample} demo={w.demo} expanded /></div>
      <section aria-labelledby="fit-reasoning">
        <div className="mb-4 flex items-center gap-2 text-board-accent"><ProfileIcon name="sliders" /><h3 id="fit-reasoning" className="text-lg font-semibold">{assessmentPending?"Agent review pending":"AI fit analysis"}</h3></div>
        <div className={styles.reasoning}>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-board-success"><ProfileIcon name="check" width={18} height={18} />Why it’s here</h4>
          <p className="max-w-prose text-sm leading-relaxed">{assessmentPending?"Saved from your onboarding preferences. Your agent still needs to verify the employer posting and compare it with your profile and résumé.":role.whyItFits || "No fit research collected yet."}</p>
        </div>
        {role.materialGap && <div className={styles.uncertainty}>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-board-warning"><ProfileIcon name="shield" width={18} height={18} />What needs a closer look</h4>
          <p className="max-w-prose text-sm leading-relaxed text-board-muted">{role.materialGap}</p>
        </div>}
        <p className="mt-3 text-xs text-board-muted">{w.demo ? "Fictional example · no live AI evaluation" : "Collected research · no new AI evaluation"}</p>
      </section>
      <RoleApplicationPreview role={role} />
      <details className="border-t border-board-line pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3"><h3 className="text-lg font-semibold">About the job</h3><ProfileIcon name="chevron" width={18} height={18} /></summary>
        <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed text-board-muted">{role.description || "Full description not collected. Open the employer posting to verify responsibilities, requirements and availability."}</p>
      </details>
    </div>
    <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-board-line bg-board-panel px-5 py-4 sm:px-8">
      <p className="text-xs text-board-muted">{w.demo ? "Demo preview · no external actions" : "Opening the posting adds it to Auto Tracker."}</p>
      {w.demo ? <button className={secondary} onClick={onClose}>Back to Discover</button> : <a href={role.applicationUrl} target="_blank" rel="noopener noreferrer" className={primary} onClick={() => recordRoleOpened(w.store, role.id)}>Open employer posting</a>}
    </footer>
  </dialog>;
}
