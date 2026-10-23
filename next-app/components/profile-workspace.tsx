"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileSurface, { profileStyles } from "./profile-surface";
import { useWorkspace } from "../lib/workspace";
import { Heading, secondary, control } from "./ui";
import ProfileEditor from "./profile-editor";
import ProfileOverview from "./profile-overview";
import ProfileDocuments from "./profile-documents";
import AppearanceSettings from "./appearance-settings";

import SearchTargets from "./search-targets";
import DailySchedule from "./daily-schedule";
import CircleAgentSettings from "./circle-agent-settings";
import Preferences from "./preferences";
import AgentConnections from "./agent-connections";
import {
  ApplicationProfileProvider,
  useApplicationProfile,
} from "./application-profile-context";
import {
  ProfileSwitcher,
  EligibilitySettings,
  WritingStyles,
} from "./profile-settings";
type ProfileSectionId = "overview" | "about" | "preferences" | "agent" | "appearance";
const sections: [ProfileSectionId, string][] = [
  ["overview", "Overview"],
  ["about", "About me"],
  ["preferences", "Job preferences"],
  ["agent", "My Agent"],
  ["appearance", "Appearance"],
];
function ProfileContent() {
  const a = useApplicationProfile();
  const [active, setActive] = useState<ProfileSectionId>("overview"),
    [visited, setVisited] = useState<ProfileSectionId[]>([]);
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    const requested = section === "kit" ? "preferences" : section;
    if (sections.some(([id]) => id === requested)) {
      setActive(requested as ProfileSectionId);
      setVisited([requested as ProfileSectionId]);
    }
  }, []);
  function select(id: ProfileSectionId) {
    setActive(id);
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }
  return (
    <ProfileSurface>
      <div className={profileStyles.profileHeader}>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <ProfileSwitcher/>
      </div>
      <label className={profileStyles.mobileSelect}>
        <span>Profile section</span>
        <select
          className={control}
          value={active}
          onChange={(e) => select(e.target.value as ProfileSectionId)}
        >
          {sections.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <nav aria-label="Profile sections" className={profileStyles.tabs}>
        {sections.map(([id, title]) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => select(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {active === "overview" && <ProfileOverview onSelect={select} />}
      {visited.includes("about") && (
        <section
          className={profileStyles.panel}
          hidden={active !== "about"}
          aria-label="About me"
        >
          <div className={profileStyles.sectionIntro}>
            <h2>About me</h2>
          </div>
          <ProfileEditor>
            <EligibilitySettings />
            <ProfileDocuments/>
          </ProfileEditor>
        </section>
      )}
      {visited.includes("preferences") && (
        <section
          className={profileStyles.panel}
          hidden={active !== "preferences"}
          aria-label="Job preferences"
        >
          <Preferences mode="search" showDefaultResume={false} />
        </section>
      )}
      {visited.includes("agent") && (
        <section
          className={`${profileStyles.panel} ${profileStyles.agentPanel}`}
          hidden={active !== "agent"}
          aria-label="My agent"
        >
          <Heading title="My agent">
            Set your writing style, connection, search schedule, and permissions.
          </Heading>
          <Link href="/onboarding/" className={secondary}>
            Change companion
          </Link>
          <WritingStyles />
          <AgentConnections />
          <CircleAgentSettings />
          <DailySchedule />
          <SearchTargets />
          <Preferences mode="agent" showDefaultResume={false} />
        </section>
      )}
      {visited.includes("appearance") && <section className={profileStyles.panel} hidden={active !== "appearance"} aria-label="Appearance"><AppearanceSettings /></section>}
      {a.saveError && <p role="alert" className="text-sm text-board-muted">
        {a.feedback} <button type="button" className={secondary} disabled={a.busy} onClick={a.retrySave}>Retry saving</button>
      </p>}

    </ProfileSurface>
  );
}
export default function ProfileWorkspace() {
  const w = useWorkspace();
  return (
    <ApplicationProfileProvider
      key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"}
    >
      <ProfileContent />
    </ApplicationProfileProvider>
  );
}
