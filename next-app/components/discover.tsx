"use client";
import { roleApplied } from '../../lib/discover-application-state.mjs';
import { useRef, useState } from "react";
import {matchesPostingAge,postingAgeOptions} from "../../lib/posting-age.mjs";
import { useWorkspace } from "../lib/workspace";
import { Heading, control, Notice, InsetBox } from "./ui";
import RoleCard, { type Role } from "./role-card";
import DiscoverRolePanel from "./discover-role-panel";
import SearchSweeps from "./search-sweeps";
import CardPackWidgets from "./card-pack-widgets";
import { PackSetupSuggestion } from "./discovery-setup-link";
import DayFilter from "./day-filter";
import ProfileIcon from "./profile-icon";
import {savedOnboardingRole} from "../lib/onboarding-catalog.mjs";
import {ApplicationProfileProvider, useApplicationProfile} from "./application-profile-context";
import {ProfileSwitcher} from "./profile-settings";
import {matchesProfileEmployment, showAgentEmptyState} from "../lib/discover-view.mjs";
import { motion, useReducedMotion } from "framer-motion";
import cardStyles from "./role-card.module.css";
import type { Drop } from "../lib/drop-pack";
export default function Discover() {
  const w = useWorkspace();
  return <ApplicationProfileProvider key={`${w.accountUser?.id || "guest"}:${w.demo}:${w.demoEpoch}`}><SelectedBoard/></ApplicationProfileProvider>;
}
function SelectedBoard() {
  const a = useApplicationProfile();
  return <DiscoverBoard key={a.profile.id}/>;
}
function DiscoverBoard() {
  const w = useWorkspace();
  const a = useApplicationProfile();
  const [publicView,setPublicView]=useState(false);
  const newArrival=showAgentEmptyState({signedIn:!!w.user,hasPrivateBatch:w.hasPrivateBatch,demo:w.demo,demoArrival:w.state.ui?.dashboardArrival});
  const sourceRoles=(publicView?(w.publicRoles||w.roles):w.roles).filter((role:Role)=>matchesProfileEmployment(role,a.profile)).map((role:Role)=>({...role,rankingProfile:a.profile}));
  const sourceDate=publicView?(w.publicDate||w.date):w.date;
  const savedRole=!w.demo?savedOnboardingRole([a.profile],w.publicRoles||w.roles):null;
  const firstRole=savedRole&&matchesProfileEmployment(savedRole,a.profile)&&!roleApplied(savedRole,w.state.workflow.applications,w.state.tracker.items)?{...savedRole,rankingProfile:a.profile}:null;
  const reduced = useReducedMotion();
  const board = useRef<HTMLElement>(null);
  const [arrival, setArrival] = useState<{owner:string;ids:string[];run:number}|null>(null);
  const previewOwner = `${w.accountUser?.id || "guest"}:${w.demo}:${w.demoEpoch}`;
  const [selection, setSelection] = useState<{ role: Role; owner: string } | null>(null);
  const preview = selection?.owner === previewOwner ? selection.role : null;
  function setPreview(role: Role | null) { setSelection(role ? { role, owner: previewOwner } : null); }
  const [search, setSearch] = useState(""),
    [day, setDay] = useState("latest"),
    [postingAge, setPostingAge] = useState("any");
  const dates = [...new Set([sourceDate, ...sourceRoles.map((r: Role) => r.discoveredDate)].filter(Boolean))].sort().reverse();
  const selectedDay = day === "latest" ? sourceDate : day;
  const roles = sourceRoles.filter(
    (r: Role) =>
      matchesPostingAge(r, postingAge) &&
      (selectedDay === "all" || r.discoveredDate === selectedDay) &&
      (day !== "latest" || !roleApplied(r,w.state.workflow.applications,w.state.tracker.items)) &&
      `${r.company} ${r.title} ${r.location} ${r.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function populateBoard(drops: Drop[]) {
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const matches = sourceRoles.filter((role: Role) => drops.some(drop =>
      (drop.url && drop.url === role.applicationUrl) ||
      (normalize(drop.company) === normalize(role.company) && normalize(drop.title) === normalize(role.title) &&
       (!drop.location || normalize(drop.location) === normalize(role.location)))));
    if (!matches.length) return;
    setSearch(""); setDay("all"); setPostingAge("any");
    setArrival(previous => ({owner:previewOwner,ids:matches.map((role:Role)=>role.id),run:(previous?.run||0)+1}));
    requestAnimationFrame(() => board.current?.scrollIntoView({behavior: reduced ? "instant" : "smooth", block:"start"}));
  }
  const arriving = arrival?.owner === previewOwner ? arrival : null;
  const roleGroups = [{key:a.profile.id,label:a.profile.name,roles}];
  const header=<div className="mb-6 flex flex-wrap items-start justify-between gap-4 [&>.workspace-heading]:mb-0"><Heading title="Discover">{newArrival&&!publicView?"Your agent’s finds will appear here.":publicView?"Explore the public catalog.":w.batchLabel}</Heading><div className="w-full sm:w-64"><ProfileSwitcher manage={false}/></div></div>;
  if(newArrival&&!publicView)return <>
    {header}
    <PackSetupSuggestion/>
    {firstRole ? <section className="mt-6 md:mt-9" aria-label="Your first role to explore">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <RoleCard role={{...firstRole,whyItFits:"Saved from onboarding. Your agent will check availability and compare this role with your profile and résumé."}} onPreview={setPreview}/>
      </div>
      <button type="button" className="mt-4 min-h-11 text-sm text-board-muted underline underline-offset-4" onClick={()=>setPublicView(true)}>Explore public roles</button>
    </section> : <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-board-line bg-board-panel text-board-accent"><ProfileIcon name="briefcase" width={26} height={26}/></div>
      <h2 className="text-xl font-semibold">Room for your next move.</h2>
      <p className="mt-3 text-sm leading-relaxed text-board-muted">Ask your connected agent to find your first roles. Come back here to review them.</p>
      <button type="button" className="mt-6 min-h-11 text-sm text-board-muted underline underline-offset-4 hover:text-board-text" onClick={()=>setPublicView(true)}>Explore public roles</button>
      {w.demo&&<p className="mt-3 text-xs text-board-muted">Demo · a new workspace preview</p>}
    </div>}
    {preview&&<DiscoverRolePanel key={preview.id} role={preview} assessmentPending onClose={()=>setPreview(null)}/>}
  </>;
  return (
    <>
      {header}
      {newArrival&&publicView&&<button type="button" className="mb-4 min-h-11 text-sm text-board-muted underline underline-offset-4" onClick={()=>setPublicView(false)}>Back to my agent’s finds</button>}
      <InsetBox className="mb-3 grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(0,1fr)_200px_200px] md:gap-3">
        <input
          aria-label="Search roles or companies"
          placeholder="Search roles or companies"
          className={`${control} col-span-2 md:col-span-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex min-w-0 flex-col gap-1 text-xs text-board-muted">Posted<select aria-label="Posted" className={control} value={postingAge} onChange={event=>setPostingAge(event.target.value)}>{postingAgeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <DayFilter label="Discover day" dates={dates} latest={sourceDate} value={day} onChange={setDay} />

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
          {group.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {group.map((role: Role) => {
              const index = arriving?.ids.indexOf(role.id) ?? -1;
              return <motion.div className={cardStyles.gridItem} key={`${role.id}:${index >= 0 ? arriving?.run : 0}`}
                initial={index < 0 ? false : {opacity: reduced ? 0.75 : 0.35, y: reduced ? 0 : -48, rotate: reduced ? 0 : -3, scale: reduced ? 1 : 0.96}}
                animate={{opacity:1,y:0,rotate:0,scale:1}}
                transition={{duration:reduced ? 0.12 : 0.5,delay:reduced ? 0 : Math.min(index * 0.075,0.45),ease:[0.16,1,0.3,1]}}>
                <RoleCard role={role} onPreview={setPreview}/>
              </motion.div>;
            })}
          </div> : <div className="glass-inset rounded-xl px-5 py-7">
            <p className="text-sm text-board-muted">No new roles for this profile in this view.</p>
            {(search || postingAge !== "any") && <button className="mt-3 min-h-11 text-sm font-semibold text-board-accent hover:underline" onClick={() => { setSearch(""); setPostingAge("any"); }}>Clear filters</button>}
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
