"use client";
import { useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Heading, control, Notice, InsetBox } from "./ui";
import RoleCard, { type Role } from "./role-card";
import DiscoverRolePanel from "./discover-role-panel";
import SearchSweeps from "./search-sweeps";
import CardPackWidgets from "./card-pack-widgets";
import DayFilter from "./day-filter";
import { motion, useReducedMotion } from "framer-motion";
import type { Drop } from "../lib/drop-pack";
export default function Discover() {
  const w = useWorkspace();
  const reduced = useReducedMotion();
  const board = useRef<HTMLElement>(null);
  const [arrival, setArrival] = useState<{owner:string;ids:string[];run:number}|null>(null);
  const previewOwner = `${w.accountUser?.id || "guest"}:${w.demo}:${w.demoEpoch}`;
  const [selection, setSelection] = useState<{ role: Role; owner: string } | null>(null);
  const preview = selection?.owner === previewOwner ? selection.role : null;
  function setPreview(role: Role | null) { setSelection(role ? { role, owner: previewOwner } : null); }
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [day, setDay] = useState("latest");
  const dates = [...new Set([w.date, ...w.roles.map((r: Role) => r.discoveredDate)].filter(Boolean))].sort().reverse();
  const selectedDay = day === "latest" ? w.date : day;
  const roles = w.roles.filter(
    (r: Role) =>
      (selectedDay === "all" || r.discoveredDate === selectedDay) &&
      (day !== "latest" || !w.state.tracker.ids.includes(r.id)) &&
      (!type || r.employmentType === type) &&
      `${r.company} ${r.title} ${r.location} ${r.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function populateBoard(drops: Drop[]) {
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const matches = w.roles.filter((role: Role) => drops.some(drop =>
      (drop.url && drop.url === role.applicationUrl) ||
      (normalize(drop.company) === normalize(role.company) && normalize(drop.title) === normalize(role.title) &&
       (!drop.location || normalize(drop.location) === normalize(role.location)))));
    if (!matches.length) return;
    setSearch(""); setType(""); setDay("all");
    setArrival(previous => ({owner:previewOwner,ids:matches.map((role:Role)=>role.id),run:(previous?.run||0)+1}));
    requestAnimationFrame(() => board.current?.scrollIntoView({behavior: reduced ? "instant" : "smooth", block:"start"}));
  }
  const arriving = arrival?.owner === previewOwner ? arrival : null;
  const roleGroups = [["FT", "Full-time"], ["Internship", "Internships"]].map(([key, label]) => ({ key, label, roles: roles.filter((role: Role) => role.employmentType === key) }));
  return (
    <>
      <Heading title="Discover">
        {w.batchLabel}
      </Heading>
      <InsetBox className="mb-3 grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(0,1fr)_230px_160px] md:gap-3">
        <input
          aria-label="Search roles or companies"
          placeholder="Search roles or companies"
          className={`${control} col-span-2 md:col-span-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <DayFilter label="Discover day" dates={dates} latest={w.date} value={day} onChange={setDay} />
        <select
          aria-label="Employment type"
          className={control}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="FT">Full-time</option>
          <option>Internship</option>
        </select>
      </InsetBox>
      <Notice>
        {roles.length} to review ·{" "}
        {roles.filter((r: Role) => r.priority === "Apply Now").length} apply now
      </Notice>
      <CardPackWidgets key={previewOwner} onOpened={populateBoard}/>
      <section ref={board} aria-label="Discover board" className="scroll-mt-6">
      {arriving && <p role="status" className="mt-4 text-sm text-board-muted">{arriving.ids.length} pack {arriving.ids.length === 1 ? "job" : "jobs"} on your board.</p>}
      {roleGroups.map(({ key, label, roles: group }) => (
        <section key={key} data-dashboard-tour="roles" className="mt-6 md:mt-9" aria-label={label}>
          <div className="mb-3 flex items-center gap-3 md:mb-4">
            <h2 className="text-xl font-semibold tracking-tight">{label}</h2>
            <span className="rounded-md bg-board-tag px-2 py-1 text-xs tabular-nums text-board-muted">{group.length}</span>
          </div>
          {group.length ? <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 md:grid-cols-3">
            {group.map((role: Role) => {
              const index = arriving?.ids.indexOf(role.id) ?? -1;
              return <motion.div className="grid" key={`${role.id}:${index >= 0 ? arriving?.run : 0}`}
                initial={index < 0 ? false : {opacity: reduced ? 0.75 : 0.35, y: reduced ? 0 : -48, rotate: reduced ? 0 : -3, scale: reduced ? 1 : 0.96}}
                animate={{opacity:1,y:0,rotate:0,scale:1}}
                transition={{duration:reduced ? 0.12 : 0.5,delay:reduced ? 0 : Math.min(index * 0.075,0.45),ease:[0.16,1,0.3,1]}}>
                <RoleCard role={role} onPreview={setPreview}/>
              </motion.div>;
            })}
          </div> : <div className="glass-inset rounded-xl px-5 py-7">
            <p className="text-sm text-board-muted">No new {label.toLowerCase()} roles for this view.</p>
            {(search || type) && <button className="mt-3 min-h-11 text-sm font-semibold text-board-accent hover:underline" onClick={() => { setSearch(""); setType(""); }}>Clear filters</button>}
          </div>}
        </section>
      ))}
      </section>
      {preview && <DiscoverRolePanel key={preview.id} role={preview} onClose={() => setPreview(null)} />}
      <SearchSweeps />
      <details className="mt-9 border-t border-board-line pt-4 text-sm text-board-muted">
        <summary className="min-h-11">How tracking works</summary>
        <p className="max-w-prose leading-relaxed">
          Previewing a job does not track it. Opening the employer posting adds it to Applications. Update the status after
          applying. Queuing creates a draft for your agent; it does not submit
          an application.
        </p>
      </details>
    </>
  );
}
