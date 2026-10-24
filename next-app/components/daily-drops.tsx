"use client";
import {rarityOf} from "../lib/role-display";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { dayStamp } from "../lib/progress.mjs";
import { dropKey, tierOf, tierOrder as canonicalTiers, type Drop } from "../lib/drop-pack";
import { RARITY_LABEL, TIER_HEX } from "../lib/role-display";
import { secondary } from "./ui";
import { CompanyLogo } from "./role-card";
import DayFilter from "./day-filter";
import PackOpening from "./pack-opening";
import styles from "./daily-drops.module.css";

const tierOrder = [...canonicalTiers].reverse();
function formatDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return year && month && date ? new Date(year, month - 1, date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : day;
}
function Chevron() {
  return <svg className={styles.caret} viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function DropRow({ drop, isNew, demo }: { drop: Drop; isNew: boolean; demo: boolean }) {
  const tier = tierOf(drop) as keyof typeof TIER_HEX;
  const noteLines = (drop.note || "").split(/\n|;\s+/).map((line) => line.trim()).filter(Boolean);
  return <details className={styles.row}>
    <summary className={styles.rowSummary}>
      <span className={styles.logo}><CompanyLogo company={drop.company} /></span>
      <span className={styles.rowTitle}><strong>{drop.title}</strong><span>{drop.company}</span></span>
      <span className={styles.badges}>
        {isNew && <span className={styles.newMarker}>New</span>}
        <span className={styles.tierBadge} style={{ backgroundColor: `color-mix(in srgb, ${TIER_HEX[tier]} 23%, #172134)` }}>{RARITY_LABEL[tier]}</span>
        <span className={styles.status} data-status={drop.status}>{drop.status || "pending"}</span>
      </span>
      <Chevron />
    </summary>
    <div className={styles.rowDetails}>
      <p className={styles.meta}>{[drop.type === "FT" ? "Full-time" : drop.type, `Seen ${drop.dateSeen}`, drop.location, drop.comp ? `Comp: ${drop.comp}` : null].filter(Boolean).map((item, index) => <span key={index}>{item}</span>)}</p>
      {drop.skipReason && <p className={styles.skipReason}>Skipped: {drop.skipReason}</p>}
      {noteLines.length > 1 ? <ul className={styles.notes}>{noteLines.map((line, index) => <li key={index}>{line}</li>)}</ul> : noteLines.length > 0 && <p className={styles.note}>{noteLines[0]}</p>}
      {drop.url ? <a className={styles.posting} href={drop.url} onClick={(event) => { if (demo) event.preventDefault(); }} target="_blank" rel="noopener noreferrer">{demo ? "Source posting (demo)" : "Open posting"}</a> : <p className={styles.note}>No link captured from story</p>}
    </div>
  </details>;
}
export default function DailyDrops({id,title,drops,onOpened}:{id:string;title:string;drops:Drop[];onOpened?:(drops:Drop[])=>void}) {
  const [day,setDay]=useState('latest'),[packOpen,setPackOpen]=useState(false);
  const w=useWorkspace();
  if(!drops.length)return <section className={styles.strip} aria-label={title}><h2 className={styles.title}>{title}</h2><p className="mt-3 text-sm text-board-muted">No cards yet. Ask a connected agent to publish discoveries into this pack.</p></section>;
  const latest = drops.map(drop=>({...drop,displayTier:rarityOf(drop.company,drop.type,drop.title,w.state.workflow,drop.searchProfileId) as Drop["displayTier"]})).sort((a, b) => b.dateSeen.localeCompare(a.dateSeen));
  const dates = [...new Set(latest.map((drop) => drop.dateSeen))];
  const selectedDay = day === "latest" ? dates[0] : day;
  const visible = latest.filter((drop) => selectedDay === "all" || drop.dateSeen === selectedDay);
  const packDay = selectedDay === "all" ? dates.find((date) => latest.some((drop) => drop.dateSeen === date && drop.status !== "skipped")) || dates[0] : selectedDay;
  const pack = latest.filter((drop) => drop.dateSeen === packDay && drop.status !== "skipped");
  const packAction = packDay === dayStamp() && !w.state.drops?.packStamps?.[`${id}:${packDay}`] ? "Open" : "Replay";
  const seen = new Set<string>(w.state.drops?.seenDropIds || []);
  const newCount = visible.filter((drop) => !seen.has(dropKey(drop))).length;
  const tiers = tierOrder.filter((tier) => visible.some((drop) => tierOf(drop) === tier));
  function markSeen(items: Drop[]) {
    w.store.update("drops.seenDropIds", (previous: string[] = []) => [...new Set([...previous, ...items.map(dropKey)])]);
  }
  function closePack(opened: boolean) {
    setPackOpen(false);
    if (opened) onOpened?.(pack.filter(drop => drop.status !== "skipped"));
    markSeen(pack);
    w.store.set(`drops.packStamps.${id}:${packDay}`, true);
  }
  return <section className={styles.strip} aria-label={title}>
    <div className={styles.header}>
      <div className={styles.info}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.banner}>
          <strong>{selectedDay === "all" ? "All history" : formatDay(selectedDay)}</strong>
          <span>{visible.length} drops</span><span className={styles.addedCount}>{visible.filter((drop) => drop.status === "added").length} added</span>
          <span className={styles.dots} aria-label={`Tiers: ${tiers.map((tier) => RARITY_LABEL[tier]).join(", ")}`}>{tiers.map((tier) => <i key={tier} title={RARITY_LABEL[tier]} style={{ backgroundColor: TIER_HEX[tier] }} />)}</span>
          {newCount > 0 && <span className={styles.newMarker}>{newCount} new</span>}
          {day === "latest" && dates.length > 1 && <span>+{dates.length - 1} {dates.length === 2 ? "day" : "days"}</span>}
        </div>
      </div>
      {pack.length > 0 && <button className={`${secondary} ${styles.packButton}`} onClick={() => setPackOpen(true)} aria-label={`${packAction} ${formatDay(packDay)} drop pack`}>{packAction} pack</button>}
    </div>
    <details className={styles.dropdown} onToggle={(event) => { if (event.currentTarget.open) markSeen(visible); }}>
      <summary className={styles.dropdownSummary}><span>{selectedDay === "all" ? "View drop history" : "View drops and skipped roles"}</span><Chevron /></summary>
      <div className={styles.full}>
        <div className={styles.filter}><DayFilter label="Drops day" dates={dates} latest={dates[0]} value={day} onChange={(value) => { setDay(value); setPackOpen(false); }} /></div>
        {(selectedDay === "all" ? dates : [selectedDay]).map((date) => {
          const dayDrops = visible.filter((drop) => drop.dateSeen === date);
          const active = [...dayDrops.filter((drop) => drop.status === "added"), ...dayDrops.filter((drop) => drop.status !== "added" && drop.status !== "skipped")];
          const skipped = dayDrops.filter((drop) => drop.status === "skipped");
          return <section key={date} className={styles.dateGroup} aria-label={`Drops from ${date}`}>
            <h3 className={styles.dateTitle}>{formatDay(date)} <span>— tap a row for details</span></h3>
            <div className={styles.rows}>{active.map((drop) => <DropRow key={dropKey(drop)} drop={drop} isNew={!seen.has(dropKey(drop))} demo={w.demo} />)}</div>
            {skipped.length > 0 && <details className={styles.skipped}><summary><span>{skipped.length} skipped {skipped.length === 1 ? "role" : "roles"}</span><Chevron /></summary><div className={styles.rows}>{skipped.map((drop) => <DropRow key={dropKey(drop)} drop={drop} isNew={!seen.has(dropKey(drop))} demo={w.demo} />)}</div></details>}
          </section>;
        })}
      </div>
    </details>
    {packOpen && <PackOpening packId={id} title={title} drops={pack} day={packDay} onClose={closePack} />}
  </section>;
}
