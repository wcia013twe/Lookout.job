"use client";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../lib/workspace";
import { primary, secondary, control, Field } from "./ui";
import { CompanyLogo, type Role } from "./role-card";
import RoleMatchPreview from "./role-match-preview";
import { rarityOf, RARITY_LABEL, tierIndex } from "../lib/role-display";
import { recordRoleOpened } from "../lib/progress.mjs";
import styles from "./discover-role-panel.module.css";
export default function DiscoverRolePanel({ role, onClose }: { role: Role; onClose: () => void }) {
  const w = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const rarity = rarityOf(role.company, role.employmentType, role.title) as keyof typeof RARITY_LABEL;
  const eligible = tierIndex(rarity) >= tierIndex("common");
  const profile = w.state.workflow.profile || {};
  const sample = w.demo ? role.matchPreview : undefined;
  useEffect(() => {
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => { node?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className={styles.panel} aria-labelledby="discover-role-heading" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="sticky top-0 z-10 border-b border-board-line bg-board-panel px-5 py-4 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><CompanyLogo company={role.company} /><div><p className="text-sm text-board-muted">{role.company} · {RARITY_LABEL[rarity]}</p><h2 id="discover-role-heading" className="mt-1 break-words text-xl font-semibold tracking-tight">{role.title}</h2></div></div>
        <button autoFocus className={`${secondary} shrink-0`} onClick={onClose} aria-label="Close job preview">Close</button>
      </div>
      <p className="mt-3 text-sm text-board-muted">{role.employmentType === "FT" ? "Full-time" : role.employmentType} · {role.location}</p>
    </header>
    <div className="space-y-8 px-5 py-6 sm:px-8">
      <RoleMatchPreview sample={sample} expanded />
      <section aria-labelledby="about-job"><h3 id="about-job" className="mb-3 text-lg font-semibold">About the job</h3><p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-board-muted">{role.description || "The full employer description has not been collected. Open the employer posting to verify responsibilities, requirements and current availability."}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-board-muted">Focus</dt><dd className="mt-1">{role.category || "Not listed"}</dd></div><div><dt className="text-board-muted">Posted</dt><dd className="mt-1">{role.postedDate || "Not disclosed"}</dd></div></dl><p className="mt-3 text-xs text-board-muted">{role.sourceFreshness}</p></section>
      <section aria-labelledby="fit-reasoning"><h3 id="fit-reasoning" className="mb-3 text-lg font-semibold">AI fit analysis</h3><p className="mb-3 text-xs text-board-muted">{w.demo ? "Fictional example · no live AI evaluation" : "Collected research notes · no new AI evaluation in this preview"}</p><p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{role.whyItFits || "No fit research has been collected for this role yet."}</p><h4 className="mb-2 mt-5 text-sm font-semibold">What still needs verification</h4><p className="max-w-prose text-sm leading-relaxed text-board-muted">{sample ? "The demo profile’s query-service work suggests a systems connection. Production ownership and the actual team’s requirements still need verification. Compensation and culture examples above are fictional." : "A current resume-to-requirements comparison is unavailable here. Verify the team, level, compensation, work setting and material experience gaps before treating this as a recommendation. Company tier alone does not establish personal fit."}</p></section>
      {eligible && <section aria-labelledby="application-preview"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 id="application-preview" className="text-lg font-semibold">Prefilled application</h3><span className="text-xs text-board-muted">Common tier and above</span></div><p className="mb-4 max-w-prose text-sm leading-relaxed text-board-muted">Preview from your saved profile. Edits stay in this panel and are discarded when closed. The employer’s actual form has not been fetched or filled.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input className={control} autoComplete="off" defaultValue={profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" ")} placeholder="Add your name" /></Field><Field label="Email"><input className={control} type="email" autoComplete="off" defaultValue={profile.email || ""} placeholder="Add your email" /></Field><Field label="Phone"><input className={control} type="tel" autoComplete="off" defaultValue={profile.phone || ""} placeholder="Add your phone" /></Field><Field label="Location"><input className={control} autoComplete="off" defaultValue={profile.location || ""} placeholder="Add your location" /></Field></div><p className="mt-4 text-xs leading-relaxed text-board-muted">Resume selection and employer-specific answers need review in Applications. Nothing in this preview authorizes or submits an application.</p></section>}
    </div>
    <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-board-line bg-board-panel px-5 py-4 sm:px-8"><p className="text-xs text-board-muted">{w.demo ? "Demo preview · no external actions" : "Opening the posting adds it to Auto Tracker."}</p>{w.demo ? <button className={secondary} onClick={onClose}>Back to Discover</button> : <a href={role.applicationUrl} target="_blank" rel="noopener noreferrer" className={primary} onClick={() => recordRoleOpened(w.store, role.id)}>Open employer posting</a>}</footer>
  </dialog>;
}
