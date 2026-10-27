"use client";
import { useEffect, useState } from "react";
import ProfileSurface, { profileStyles } from "./profile-surface";
import { useWorkspace } from "../lib/workspace";
import { secondary, control } from "./ui";
import ProfileEditor from "./profile-editor";
import ProfileDocuments from "./profile-documents";
import AppearanceSettings from "./appearance-settings";

import DiscoverySetup from "./discovery-setup";
import CircleAgentSettings from "./circle-agent-settings";
import Preferences from "./preferences";
import {
  ApplicationProfileProvider,
  useApplicationProfile,
} from "./application-profile-context";
import {
  ProfileSwitcher,
  EligibilitySettings,
  WritingStyles,
} from "./profile-settings";
type ProfileSectionId = "about" | "preferences" | "agent" | "appearance";
const sections: [ProfileSectionId, string][] = [
  ["about", "About me"],
  ["preferences", "Job preferences"],
  ["agent", "My Agent"],
  ["appearance", "Appearance"],
];
function ProfileContent() {
  const a = useApplicationProfile();
  const [active, setActive] = useState<ProfileSectionId>("about"),
    [visited, setVisited] = useState<ProfileSectionId[]>(["about"]);
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    const requested = section === "kit" ? "preferences" : section === "overview" ? "about" : section;
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
          <DiscoverySetup>
          <WritingStyles />
          <CircleAgentSettings />
          <Preferences mode="agent" showDefaultResume={false} />
          </DiscoverySetup>
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
