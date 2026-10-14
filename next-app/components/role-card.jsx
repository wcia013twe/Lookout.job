"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { dayStamp, recordDay } from "../lib/progress.mjs";
import { primary, secondary } from "./ui";
import logos from "../../data/logo-manifest.json";
import {
  normCompany,
  rarityOf,
  RARITY_LABEL,
  TIER_HEX,
  compensationTag,
} from "../lib/role-display";
export function CompanyLogo({ company }) {
  const [failed, setFailed] = useState(false);
  const entry = logos[normCompany(company)];
  return entry && !failed ? (
    <img
      src={entry.url}
      alt={`${company} logo`}
      width="38"
      height="38"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-board-tag text-sm font-bold"
    >
      {company
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export default function RoleCard({ role }) {
  const w = useWorkspace();
  const queued = Boolean(w.state.workflow.applications[role.id]);
  const rarity = rarityOf(role.company, role.employmentType, role.title);
  function open() {
    recordDay(w.store);
    w.store.update("tracker.ids", (ids) => [
      ...new Set([...(ids || []), role.id]),
    ]);
    w.store.update("tracker.items", (items) => ({
      ...items,
      [role.id]: {
        ...items?.[role.id],
        openedDate: items?.[role.id]?.openedDate || dayStamp(),
        status: items?.[role.id]?.status || "New",
      },
    }));
  }
  function queue() {
    if (!queued)
      w.store.update("workflow.applications", (apps) => ({
        ...apps,
        [role.id]: w.models.workflowModel.create(role),
      }));
  }
  return (
    <article
      className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-board-panel p-4 sm:p-[18px]"
      style={{
        borderColor: `color-mix(in srgb, ${TIER_HEX[rarity]} 55%, #343442)`,
      }}
    >
      <div className="flex items-center gap-3">
        <CompanyLogo company={role.company} />
        <strong className="min-w-0 flex-1 break-words">{role.company}</strong>
        <span
          className="rounded-md px-2 py-1 text-xs font-bold"
          style={{ color: TIER_HEX[rarity], background: "#242430" }}
        >
          {RARITY_LABEL[rarity]}
        </span>
      </div>
      <h3 className="text-lg font-bold leading-snug">{role.title}</h3>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          role.employmentType === "FT" ? "Full-time" : role.employmentType,
          role.location,
          compensationTag(role.whyItFits),
        ]
          .filter(Boolean)
          .map((tag, i) => (
            <span key={i} className="rounded-md bg-board-tag px-2 py-1">
              {tag}
            </span>
          ))}
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-board-muted">
        {role.whyItFits}
      </p>
      <details className="text-sm">
        <summary className="flex min-h-11 items-center text-board-accent">
          View analysis
        </summary>
        <p className="mt-3 leading-relaxed text-board-muted">
          {role.whyItFits}
        </p>
        <p className="mt-3 text-xs text-board-muted">
          {role.category} · Posted {role.postedDate || "Not listed"} ·{" "}
          {role.sourceFreshness}
        </p>
      </details>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <button onClick={queue} disabled={queued} className={secondary}>
          {queued ? "Queued" : "Queue application"}
        </button>
        <a
          className={primary}
          href={role.applicationUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={open}
        >
          Open application
        </a>
      </div>
    </article>
  );
}
