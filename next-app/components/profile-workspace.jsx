"use client";
import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, Field, control } from "./ui";
import ProfileEditor from "./profile-editor";
import Resumes from "./resumes";
import SavedAnswers from "./saved-answers";
import Preferences from "./preferences";
import TierLists from "./tierlists";
import AgentConnections from "./agent-connections";

const sections = [
  ["about", "About me", "Contact details, experience, education, projects, and skills."],
  ["kit", "Application kit", "Resumes and saved answers for your applications."],
  ["preferences", "Job preferences", "Search criteria and company tiers."],
  ["agent", "My agent", "Your companion, connection, and permissions."],
];

export default function ProfileWorkspace() {
  const w = useWorkspace();
  const profile = w.state.workflow.profile;
  const resumes = w.state.workflow.resumes || [];
  const [active, setActive] = useState("overview");
  const [visited, setVisited] = useState([]);
  function select(id) {
    setActive(id);
    setVisited((previous) => previous.includes(id) ? previous : [...previous, id]);
  }
  const defaultResume = resumes.find((resume) => resume.id === w.state.workflow.searchPreferences?.defaultResumeId);
  const complete = Boolean(profile.name && (profile.setupAgent || resumes.length));
  return (
    <>
      <Heading title="My Profile">Your details, application kit, and job search settings.</Heading>
      <nav aria-label="Profile sections" className="mb-6 flex flex-wrap gap-2">
        {[["overview", "Overview"], ...sections.map(([id, title]) => [id, title])].map(([id, title]) => (
          <button key={id} type="button" className={active === id ? primary : secondary} aria-pressed={active === id} onClick={() => select(id)}>{title}</button>
        ))}
      </nav>
      {active === "overview" && <>
        <section aria-label="Profile summary" className="border-y border-board-line py-5">
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
        <div className="mt-3 divide-y divide-board-line">
          {sections.map(([id, title, description]) => <button key={id} type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-5 text-left hover:text-board-accent" onClick={() => select(id)}><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-board-muted">{description}</span></span><span className="text-sm text-board-accent">Open</span></button>)}
        </div>
      </>}
      {visited.includes("about") && <section hidden={active !== "about"} aria-label="About me"><ProfileEditor /></section>}
      {visited.includes("kit") && <section hidden={active !== "kit"} aria-label="Application kit"><Resumes /><Field label="Default private PDF resume"><select className={control} value={w.state.workflow.searchPreferences?.defaultResumeId || ""} onChange={(e) => w.store.update("workflow.searchPreferences", (previous) => ({ ...previous, defaultResumeId: e.target.value || null }))}><option value="">Choose a private uploaded PDF</option>{resumes.filter((resume) => /\.pdf$/i.test(resume.objectPath || "") && resume.contentHash).map((resume) => <option key={resume.id} value={resume.id}>{resume.name}</option>)}</select></Field><p className="mt-2 text-xs text-board-muted">Default resume selection saves automatically.</p><SavedAnswers /></section>}
      {visited.includes("preferences") && <section hidden={active !== "preferences"} aria-label="Job preferences"><Preferences showDefaultResume={false} /><TierLists /></section>}
      {visited.includes("agent") && <section hidden={active !== "agent"} aria-label="My agent"><Heading title="My agent">Manage your connection and permissions.</Heading><Link href="/onboarding/" className={secondary}>Change companion</Link><AgentConnections /></section>}
    </>
  );
}
