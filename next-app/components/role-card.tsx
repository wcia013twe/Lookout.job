"use client";
import { type CSSProperties, type PointerEvent } from "react";
import styles from "./role-card.module.css";
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from "framer-motion";

export type Role = {
  id: string; company: string; title: string; employmentType: string;
  location: string; category: string; priority: string; postedDate?: string | null;
  description?: string; matchPreview?: MatchPreview; matchAssessment?: MatchPreview;
  fitLabel?: string; materialGap?: string; rankingProfile?: any; searchProfileId?: string; evaluatedProfileVersion?: number;
  postingObservation?: {checkedAt:string;liveness:string;postedAt:string|null;description:string};
  compensation?: string; workSetting?: string; sponsorship?: string;
  reviewPreview?: { question: string; answer: string; reason: string }[];
  discoveredDate: string; sourceFreshness: string; whyItFits: string; applicationUrl: string;
};
import { useWorkspace } from "../lib/workspace";
import ApplicationActions from "./application-actions";
import RoleJobFacts from "./role-job-facts";
import RoleMatchPreview, { type MatchPreview } from "./role-match-preview";
import { primary, secondary } from "./ui";
import { CompanyLogo } from "./company-logo";
export { CompanyLogo } from "./company-logo";
import {
  rarityOf, companyRanking,
  TIER_HEX,
} from "../lib/role-display";
const REFRACTION: Record<keyof typeof TIER_HEX, string> = { common: "#7ae9db", rare: "#aeb6ff", epic: "#efb0df", legendary: "#ffa577", mythic: "#ffbb73" };

export default function RoleCard({ role, onPreview }: { role: Role; onPreview?: (role: Role) => void }) {
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
  const rarity = rarityOf(role.company, role.employmentType, role.title, w.state.workflow, role.rankingProfile || role.searchProfileId) as keyof typeof TIER_HEX;
  return (
    <motion.article
      data-discovered-role={role.id}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      onPointerMove={moveSheen}
      onPointerLeave={restSheen}
      onFocusCapture={() => { if (!reduceMotion) { sheenPosition.set(.5); sheenIntensity.set(.8); } }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) restSheen(); }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`${styles.card} glass-panel relative flex min-w-0 flex-col overflow-hidden rounded-2xl border`}
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
        {/* Ranking badge temporarily hidden.
        <span className={styles.rarity}>
          {companyRanking(role.company, role.employmentType, w.state.workflow, role.rankingProfile || role.searchProfileId).label}
        </span>
        */}
      </motion.div>
      <div className={styles.body}>
        <h3 className="break-words text-lg font-semibold leading-snug tracking-tight md:text-xl">{onPreview ? <button className="text-left" onClick={()=>onPreview(role)}>{role.title}</button> : role.title}</h3>
        <RoleJobFacts role={role} compact />
        <RoleMatchPreview sample={w.demo ? role.matchPreview : role.matchAssessment} demo={w.demo} />
        <ApplicationActions role={role} onPreview={onPreview}/>
      </div>
    </motion.article>
  );
}
