import type { Role } from "./role-card";
import {formatPostedDate,formatAvailabilityCheck,postingStatus} from "../../lib/posting-age.mjs";
import {compensationLabel,workSettingLabel,sponsorshipLabel} from "../lib/job-fact-labels";
import ProfileIcon, { type ProfileIconName } from "./profile-icon";
import { compensationTag } from "../lib/role-display";
export default function RoleJobFacts({ role, compact = false }: { role: Role; compact?: boolean }) {
  const status = postingStatus(role);
  const pay = role.compensation || compensationTag(role.whyItFits);
  const facts: { icon: ProfileIconName; label: string; value: string }[] = [
    { icon: "money", label: "Compensation", value: compensationLabel(pay) },
    { icon: "location", label: "Location", value: role.location || "Not disclosed" },
    ...(!compact ? [
      { icon: "building" as const, label: "Work setting", value: workSettingLabel(role.workSetting) },
      { icon: "sliders" as const, label: "Focus", value: role.category || "Not disclosed" },
      { icon: "shield" as const, label: "Sponsorship", value: sponsorshipLabel(role.sponsorship) },
      { icon: "clock" as const, label: "Posted", value: formatPostedDate(role) },
      { icon: "clock" as const, label: "Availability checked", value: formatAvailabilityCheck(role) },
    ] : []),
  ];
  return <section aria-label="Job facts">
    <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-board-accent/10 px-3 py-1 text-xs font-semibold text-board-accent"><ProfileIcon name="briefcase" width={15} height={15} />{role.employmentType === "FT" ? "Full-time" : role.employmentType}</span>
    <span className={`mb-3 ml-2 inline-flex items-center gap-1 text-xs ${status === "Live" ? "text-board-success" : "text-board-muted"}`} title={status === "Unverified" ? "Availability has not been verified." : `${status === "Live" ? "Active" : "Closed"} at the last employer check: ${formatAvailabilityCheck(role)}`}><ProfileIcon name={status === "Live" ? "check" : "clock"} width={14} height={14}/>{status}</span>
    <dl className={compact ? "space-y-2" : "grid grid-cols-1 gap-x-5 gap-y-5 min-[380px]:grid-cols-2"}>
      {facts.map(({ icon, label, value }) => <div key={label} className="flex min-w-0 items-start gap-2.5">
        <ProfileIcon name={icon} className={`mt-0.5 shrink-0 ${icon === "money" ? "text-board-success" : "text-board-accent"}`} width={compact ? 17 : 21} height={compact ? 17 : 21} />
        <div className="min-w-0"><dt className={compact ? "sr-only" : "mb-1 text-xs text-board-muted"}>{label}</dt><dd className={`${compact ? "text-xs" : "text-sm font-medium"} break-words leading-relaxed`}>{value}</dd></div>
      </div>)}
    </dl>
  </section>;
}
