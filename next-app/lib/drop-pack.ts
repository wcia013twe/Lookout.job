import { normCompany, rarityOf } from "./role-display.js";

export const tierOrder = ["common", "rare", "epic", "legendary", "mythic"] as const;
export type Tier = typeof tierOrder[number];
export type Stage = "mystery" | "back" | Tier;
export type Drop = {
  searchProfileId?: string; displayTier?: Tier; packId?: string; company: string; title: string; dateSeen: string; type: string;
  location?: string | null; comp?: string | null; status: string;
  note?: string | null; skipReason?: string | null; url?: string | null;
};
export type PackGroup = { key: string; drops: Drop[] };
export const dropKey = (drop: Drop) => `${drop.packId?`${drop.packId}|`:""}${drop.dateSeen}|${drop.company}|${drop.title}`;
export const tierOf = (drop: Drop): Tier => drop.displayTier || rarityOf(drop.company, drop.type, drop.title) as Tier;

export function advanceStage(stage: Stage, tier: Tier): Tier {
  if (stage === "back" || stage === "mystery") return "common";
  return tierOrder[Math.min(tierOrder.indexOf(stage) + 1, tierOrder.indexOf(tier))];
}

// A Mega drop groups at most five relevant roles from one company on one day.
export const MEGA_DROP_MAX = 5;
export function groupPack(drops: Drop[]): PackGroup[] {
  const companies = new Map<string, Drop[]>();
  for (const drop of drops) {
    const key = drop.status === "skipped" ? dropKey(drop) : `${drop.dateSeen}|${normCompany(drop.company)}`;
    companies.set(key, [...(companies.get(key) || []), drop]);
  }
  const groups: PackGroup[] = [];
  for (const company of companies.values()) {
    for (let i = 0; i < company.length; i += MEGA_DROP_MAX) {
      const batch = company.slice(i, i + MEGA_DROP_MAX);
      groups.push({ key: batch.map(dropKey).join("+"), drops: batch });
    }
  }
  return groups;
}

export function packComplete(drops: Drop[], stages: Record<string, Stage>): boolean {
  return drops.length > 0 && drops.every(drop => stages[dropKey(drop)] === tierOf(drop));
}

export function canClaimPack(drops: Drop[], stages: Record<string, Stage>, day: string, today: string): boolean {
  return day === today && drops.every(drop => drop.dateSeen === day) && packComplete(drops, stages);
}

export function demoDrops(day: string): Drop[] {
  return [
    ["NVIDIA", "ML Systems Engineer (demo)", "FT", "added"],
    ["NVIDIA", "ML Systems Intern", "Internship", "added"],
    ["Databricks", "Distributed Systems Engineer", "FT", "added"],
    ["NVIDIA", "ML Systems Internship (demo)", "Internship", "added"],
    ["NVIDIA", "Inference Infrastructure Engineer (demo)", "FT", "pending"],
    ["NVIDIA", "GPU Compiler Internship (demo)", "Internship", "added"],
    ["NVIDIA", "Distributed Training Engineer (demo)", "FT", "pending"],
    ["Google", "Distributed Systems Engineer (demo)", "FT", "pending"],
    ["Oracle", "Database Engineer (demo)", "FT", "added"],
    ["Example Company (demo)", "Unverified role (demo)", "FT", "skipped"],
  ].map(([company, title, type, status]) => ({
    company, title, type, status, dateSeen: day, location: title === "ML Systems Intern" || company === "Databricks" ? "Remote / San Francisco" : "Fictional location",
    note: "Fictional pack fixture. No real opening or submission.", url: null,
    skipReason: status === "skipped" ? "Fictional example awaiting source verification." : null,
  }));
}
