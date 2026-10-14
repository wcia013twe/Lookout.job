"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type Role = {
  id: string; company: string; title: string; employmentType: string;
  location: string; category: string; priority: string; postedDate?: string | null;
  discoveredDate: string; sourceFreshness: string; whyItFits: string; applicationUrl: string;
};
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
export function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const entry = (logos as Record<string, { url: string }>)[normCompany(company)];
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
export default function RoleCard({ role }: { role: Role }) {
  const w = useWorkspace();
  const reduceMotion = useReducedMotion();
  const queued = Boolean(w.state.workflow.applications[role.id]);
  const rarity = rarityOf(role.company, role.employmentType, role.title) as keyof typeof TIER_HEX;
  function open() {
    recordDay(w.store);
    w.store.update("tracker.ids", (ids: string[]) => [
      ...new Set([...(ids || []), role.id]),
    ]);
    w.store.update("tracker.items", (items: Record<string, { openedDate?: string; status?: string }>) => ({
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
      w.store.update("workflow.applications", (apps: Record<string, unknown>) => ({
        ...apps,
        [role.id]: w.models.workflowModel.create(role),
      }));
  }
  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel relative flex min-w-0 flex-col gap-4 rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: `color-mix(in srgb, ${TIER_HEX[rarity]} 35%, var(--color-board-line))`,
        background: "linear-gradient(145deg, #18324c65, #0b1025b8 50%, #311a3b60)",
      }}
    >
      <div className="flex items-center gap-3">
        <CompanyLogo company={role.company} />
        <strong className="min-w-0 flex-1 break-words">{role.company}</strong>
        <span
          className="shrink-0 rounded-md px-2 py-1 text-xs font-bold"
          style={{ color: "var(--color-board-text)", background: `color-mix(in srgb, ${TIER_HEX[rarity]} 24%, #162032)` }}
        >
          {RARITY_LABEL[rarity]}
        </span>
      </div>
      <h3 className="break-words text-xl font-semibold leading-snug tracking-tight">{role.title}</h3>
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
      <p className="line-clamp-3 text-sm leading-relaxed text-board-muted">
        {role.whyItFits}
      </p>
      <details className="border-t border-board-line/60 pt-1 text-sm">
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
      <div className="role-card-actions mt-auto grid gap-2 pt-2 min-[420px]:grid-cols-2">
        <button onClick={queue} disabled={queued} className={`${secondary} w-full`}>
          {queued ? "Queued" : "Queue application"}
        </button>
        <a
          className={`${primary} w-full`}
          href={role.applicationUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => { if (w.demo) event.preventDefault(); open(); }}
        >
          {w.demo ? "Simulate opening" : "Open application"}
        </a>
      </div>
    </motion.article>
  );
}
