"use client";
import { useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./role-card.module.css";
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from "framer-motion";

export type Role = {
  id: string; company: string; title: string; employmentType: string;
  location: string; category: string; priority: string; postedDate?: string | null;
  discoveredDate: string; sourceFreshness: string; whyItFits: string; applicationUrl: string;
};
import { useWorkspace } from "../lib/workspace";
import { dayStamp, recordDay } from "../lib/progress.mjs";
import { primary, secondary } from "./ui";
import { companyLogoUrl } from "../lib/company-logo";
import {
  rarityOf,
  RARITY_LABEL,
  TIER_HEX,
  compensationTag,
} from "../lib/role-display";
export function CompanyLogo({ company }: { company: string }) {
  const url = companyLogoUrl(company, process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN);
  return <CompanyLogoImage key={url || company} company={company} url={url} />;
}
function CompanyLogoImage({ company, url }: { company: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      src={url}
      alt={`${company} logo`}
      width="38"
      height="38"
      loading="lazy"
      decoding="async"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-board-tag text-sm font-bold"
    >
      {company.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
    </span>
  );
}
const REFRACTION: Record<keyof typeof TIER_HEX, string> = { common: "#7ae9db", rare: "#aeb6ff", epic: "#efb0df", legendary: "#ffa577", mythic: "#ffbb73" };

export default function RoleCard({ role }: { role: Role }) {
  const w = useWorkspace();
  const reduceMotion = useReducedMotion();
  const sheenPosition = useMotionValue(.5);
  const sheenIntensity = useMotionValue(.2);
  const smoothPosition = useSpring(sheenPosition, { stiffness: 160, damping: 28 });
  const smoothIntensity = useSpring(sheenIntensity, { stiffness: 140, damping: 25 });
  const sheenX = useTransform(smoothPosition, value => `${value * 100}%`);
  function moveSheen(event: PointerEvent<HTMLElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    sheenPosition.set(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)));
    sheenIntensity.set(.8);
  }
  function restSheen() { sheenPosition.set(.5); sheenIntensity.set(.2); }
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
      onPointerMove={moveSheen}
      onPointerLeave={restSheen}
      onFocusCapture={() => { if (!reduceMotion) { sheenPosition.set(.5); sheenIntensity.set(.8); } }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) restSheen(); }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-2xl border"
      style={{
        "--role-tier": TIER_HEX[rarity],
        "--role-refraction": REFRACTION[rarity],
        borderColor: `color-mix(in srgb, ${TIER_HEX[rarity]} 35%, var(--color-board-line))`,
      } as CSSProperties}
    >
      <motion.div className={styles.banner} style={{ "--sheen-x": reduceMotion ? "50%" : sheenX, "--sheen-strength": reduceMotion ? .2 : smoothIntensity } as CSSProperties}>
        <span aria-hidden="true" className={styles.sheen} />
        <CompanyLogo company={role.company} />
        <strong className={styles.company}>{role.company}</strong>
        <span className={styles.rarity}>
          {RARITY_LABEL[rarity]}
        </span>
      </motion.div>
      <div className={styles.body}>
        <h3 className="break-words text-lg font-semibold leading-snug tracking-tight md:text-xl">{role.title}</h3>
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
        <p className="line-clamp-2 text-sm leading-relaxed text-board-muted md:line-clamp-3">
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
        <div className="role-card-actions mt-auto grid gap-2 pt-1 min-[360px]:grid-cols-2 md:pt-2">
          <button onClick={queue} disabled={queued} className={`${secondary} w-full`}>
            {queued ? "Queued" : <><span className="md:hidden">Queue</span><span className="hidden md:inline">Queue application</span></>}
          </button>
          <a
            className={`${primary} w-full`}
            href={role.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => { if (w.demo) event.preventDefault(); open(); }}
          >
            <span className="md:hidden">{w.demo ? "Preview role" : "Open posting"}</span><span className="hidden md:inline">{w.demo ? "Simulate opening" : "Open application"}</span>
          </a>
        </div>
      </div>
    </motion.article>
  );
}
