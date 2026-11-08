import type {ReactNode} from 'react';
import type { Role } from "./role-card";
import {formatPostedDate,formatAvailabilityCheck,postingStatus} from "../../lib/posting-age.mjs";
import {compensationLabel,jobFactText} from "../lib/job-fact-labels";
import ProfileIcon, { type ProfileIconName } from "./profile-icon";
export default function RoleJobFacts({ role, compact = false, cardPreview = false, unrecorded = false, priorityTag }: { role: Role; compact?: boolean; cardPreview?: boolean; unrecorded?: boolean; priorityTag?:ReactNode }) {
  const status = postingStatus(role);
  const pay = role.compensation;
  const facts: { icon: ProfileIconName; label: string; value: string }[] = [
    { icon: "money", label: "Compensation", value: compensationLabel(pay) },
    { icon: "location", label: "Location", value: role.location || "Not disclosed" },
    ...(!compact ? [
      { icon: "building" as const, label: "Work setting", value: jobFactText(role.workSetting) },
      { icon: "sliders" as const, label: "Focus", value: role.category || "Not disclosed" },
      ...(!cardPreview ? [
      { icon: "shield" as const, label: "Sponsorship", value: jobFactText(role.sponsorship) },
      { icon: "clock" as const, label: "Posted", value: formatPostedDate(role) },
      { icon: "clock" as const, label: "Availability checked", value: formatAvailabilityCheck(role) },
      ] : []),
    ] : []),
  ];
  return <section aria-label="Job facts">
    <div className="mb-3 flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-board-accent/10 px-3 py-1 text-xs font-semibold text-board-accent"><ProfileIcon name="briefcase" width={15} height={15} />{role.employmentType === "FT" ? "Full-time" : role.employmentType}</span>
    {priorityTag}
    <span className={`inline-flex items-center gap-1 text-xs ${status === "Live" ? "text-board-success" : "text-board-muted"}`} title={status === "Unverified" ? "Availability has not been verified." : `${status === "Live" ? "Active" : "Closed"} at the last employer check: ${formatAvailabilityCheck(role)}`}><ProfileIcon name={status === "Live" ? "check" : "clock"} width={14} height={14}/>{status}</span>
    </div>
    <dl className={compact ? "space-y-2" : "grid grid-cols-1 gap-x-5 gap-y-5 min-[380px]:grid-cols-2"}>
      {facts.map(({ icon, label, value }) => <div key={label} className="flex min-w-0 items-start gap-2.5">
        <ProfileIcon name={icon} className={`mt-0.5 shrink-0 ${icon === "money" ? "text-board-success" : "text-board-accent"}`} width={compact ? 17 : 21} height={compact ? 17 : 21} />
        <div className="min-w-0"><dt className={compact ? "sr-only" : "mb-1 text-xs text-board-muted"}>{label}</dt><dd className={`${compact ? "text-xs" : "text-sm font-medium"} break-words leading-relaxed`}>{unrecorded&&/^(Not disclosed|Not recorded|Not checked)$/i.test(value)?"N/A":value}</dd></div>
      </div>)}
    </dl>
  </section>;
}
