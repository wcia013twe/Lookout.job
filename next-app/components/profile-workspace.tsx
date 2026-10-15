"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ProfileSurface, { ProfilePanel, profileStyles } from "./profile-surface";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, Field, control } from "./ui";
import type { ResumeRecord } from "./profile-types";
import ProfileEditor from "./profile-editor";
import Resumes from "./resumes";
import SavedAnswers from "./saved-answers";
import SearchTargets from "./search-targets";
import Preferences from "./preferences";
import AgentConnections from "./agent-connections";

type ProfileSection = "overview" | "about" | "kit" | "preferences" | "agent";
const sections: [ProfileSection, string, string][] = [
  ["about", "About me", "Contact details, experience, education, projects, and skills."],
  ["kit", "Application kit", "Resumes and saved answers for your applications."],
  ["preferences", "Job preferences", "Named search profiles, job criteria, career goals, and company priorities."],
  ["agent", "My agent", "Your companion, connection, search targets, updates, and application permissions."],
];
const sectionOptions: [ProfileSection, string][] = [["overview", "Overview"], ...sections.map(([id, title]) => [id, title] as [ProfileSection, string])];

export default function ProfileWorkspace() {
  const w = useWorkspace();
  const profile = w.state.workflow.profile;
  const resumes: ResumeRecord[] = w.state.workflow.resumes || [];
  const [active, setActive] = useState<ProfileSection>("overview");
  const reducedMotion = useReducedMotion();
  const [visited, setVisited] = useState<ProfileSection[]>([]);
  function select(id: ProfileSection) {
    setActive(id);
    setVisited((previous) => previous.includes(id) ? previous : [...previous, id]);
  }
  const defaultResume = resumes.find((resume) => resume.id === w.state.workflow.searchPreferences?.defaultResumeId);
  const complete = Boolean(profile.name && (profile.setupAgent || resumes.length));
  return (
    <ProfileSurface>
      <Heading title="My Profile">Your details, application kit, and job search settings.</Heading>
      <label className={profileStyles.mobileSelect}>
        <span>Profile section</span>
        <select className={control} value={active} onChange={(event) => select(event.target.value as ProfileSection)}>
          {sectionOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <nav aria-label="Profile sections" className={profileStyles.tabs}>
        {sectionOptions.map(([id, title]) => (
          <button key={id} type="button"  aria-pressed={active === id} onClick={() => select(id)}>{active === id && <motion.span layoutId="profile-tab" className={profileStyles.tabHighlight} transition={{ duration: reducedMotion ? 0 : .24, ease: [0.16, 1, 0.3, 1] }} />}{title}</button>
        ))}
      </nav>
      {active === "overview" && <ProfilePanel panelKey="overview">
        <section aria-label="Profile summary" className={`glass-panel ${profileStyles.summary}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{profile.name || "Your profile"}</h2>
              <p className="mt-2 text-sm text-board-muted">{[profile.headline, profile.location].filter(Boolean).join(" · ") || "Add your headline and location in About me."}</p>
              <p className="mt-3 text-sm text-board-muted">{profile.verified ? "Facts checked by you" : "Facts need your review"}</p>
            </div>
            <Link href="/onboarding/" className={complete ? secondary : primary}>{complete ? "Redo setup" : "Start setup"}</Link>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-board-muted">Default resume</dt><dd className="mt-1">{defaultResume?.name || "No default resume selected"}</dd></div>
            <div><dt className="text-board-muted">Agent</dt><dd className="mt-1">{profile.setupAgentName || (profile.setupAgent === "platform" ? "Platform agent" : "Not selected")} <button type="button" className="ml-2 min-h-11 text-board-accent underline underline-offset-4" onClick={() => select("agent")}>Manage connection</button></dd></div>
          </dl>
          {!profile.verified && <button type="button" className={`${secondary} mt-4`} onClick={() => select("about")}>Review profile facts</button>}
          {profile.verified && !resumes.length && <button type="button" className={`${secondary} mt-4`} onClick={() => select("kit")}>Add a resume</button>}
        </section>
        <div className={profileStyles.sectionList}>
          {sections.map(([id, title, description]) => <button key={id} type="button" className={profileStyles.sectionRow} onClick={() => select(id)}><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-board-muted">{description}</span></span><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></button>)}
        </div>
      </ProfilePanel>}
      {visited.includes("about") && <section className={profileStyles.panel} hidden={active !== "about"} aria-label="About me"><ProfileEditor /></section>}
      {visited.includes("kit") && <section className={profileStyles.panel} hidden={active !== "kit"} aria-label="Application kit"><Resumes /><Field label="Default private PDF resume"><select className={control} value={w.state.workflow.searchPreferences?.defaultResumeId || ""} onChange={(e) => w.store.update("workflow.searchPreferences", (previous: Record<string, unknown>) => ({ ...previous, defaultResumeId: e.target.value || null }))}><option value="">Choose a private uploaded PDF</option>{resumes.filter((resume) => /\.pdf$/i.test(resume.objectPath || "") && resume.contentHash).map((resume) => <option key={resume.id} value={resume.id}>{resume.name}</option>)}</select></Field><p className="mt-2 text-xs text-board-muted">Default resume selection saves automatically.</p><SavedAnswers /></section>}
      {visited.includes("preferences") && <section className={profileStyles.panel} hidden={active !== "preferences"} aria-label="Job preferences"><Preferences mode="search" showDefaultResume={false} /></section>}
      {visited.includes("agent") && <section className={profileStyles.panel} hidden={active !== "agent"} aria-label="My agent"><Heading title="My agent">Manage your connection, search targets, and permissions.</Heading><Link href="/onboarding/" className={secondary}>Change companion</Link><AgentConnections /><SearchTargets /><Preferences mode="agent" showDefaultResume={false} /></section>}
    </ProfileSurface>
  );
}
