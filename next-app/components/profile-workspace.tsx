"use client";
import { useState } from "react";
import Link from "next/link";
import ProfileSurface, { profileStyles } from "./profile-surface";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, control, Field } from "./ui";
import ProfileEditor from "./profile-editor";
import ProfileOverview from "./profile-overview";
import Resumes from "./resumes";
import SavedAnswers from "./saved-answers";
import SearchTargets from "./search-targets";
import Preferences from "./preferences";
import AgentConnections from "./agent-connections";
import {
  ApplicationProfileProvider,
  useApplicationProfile,
} from "./application-profile-context";
import {
  ProfileSwitcher,
  EligibilitySettings,
  ApplicationMaterials,
  WritingStyles,
} from "./profile-settings";
type ProfileSection = "overview" | "about" | "kit" | "preferences" | "agent";
const sections: [ProfileSection, string][] = [
  ["overview", "Overview"],
  ["about", "About me"],
  ["kit", "Application kit"],
  ["preferences", "Job preferences"],
  ["agent", "My agent"],
];
function ProfileContent() {
  const w = useWorkspace(),
    a = useApplicationProfile();
  const [active, setActive] = useState<ProfileSection>("overview"),
    [visited, setVisited] = useState<ProfileSection[]>([]);
  function select(id: ProfileSection) {
    setActive(id);
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }
  return (
    <ProfileSurface>
      <div className={profileStyles.profileHeader}>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        {active!=="agent"&&<ProfileSwitcher/>}
      </div>
      <label className={profileStyles.mobileSelect}>
        <span>Profile section</span>
        <select
          className={control}
          value={active}
          onChange={(e) => select(e.target.value as ProfileSection)}
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
          </ProfileEditor>
        </section>
      )}
      {visited.includes("kit") && (
        <section
          className={profileStyles.panel}
          hidden={active !== "kit"}
          aria-label="Application kit"
        >
          <div className={profileStyles.sectionIntro}>
            <h2>Application kit</h2>
            <p>The right materials and voice for {a.profile.name}.</p>
          </div>
          <ApplicationMaterials />
          <WritingStyles />
          <details className="mt-8 border-t border-board-line py-4" open>
            <summary className="text-lg font-semibold">
              Shared resume library
            </summary>
            <Resumes />
          </details>
          <details className="mt-6 border-t border-board-line py-4" open>
            <summary className="text-lg font-semibold">
              Shared employer-answer library
            </summary>
            <SavedAnswers />
          </details>
          <details className="mt-6 border-t border-board-line py-4">
            <summary className="font-semibold">
              Account-wide submission resume
            </summary>
            <p className="my-4 text-sm text-board-muted">
              Existing automatic submission uses this private PDF default.
              Profile selections guide preparation and do not change submission
              authorization.
            </p>
            <Field label="Default private PDF resume">
              <select
                className={control}
                value={
                  w.state.workflow.searchPreferences?.defaultResumeId || ""
                }
                onChange={(e) =>
                  w.store.update(
                    "workflow.searchPreferences",
                    (p: Record<string, unknown>) => ({
                      ...p,
                      defaultResumeId: e.target.value || null,
                    }),
                  )
                }
              >
                <option value="">Choose a private uploaded PDF</option>
                {w.state.workflow.resumes
                  .filter(
                    (r: { objectPath?: string; contentHash?: string }) =>
                      /\.pdf$/i.test(r.objectPath || "") && r.contentHash,
                  )
                  .map((r: { id: string; name: string }) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="mt-2 text-xs text-board-muted">
              This account-wide setting saves automatically.
            </p>
          </details>
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
          className={profileStyles.panel}
          hidden={active !== "agent"}
          aria-label="My agent"
        >
          <Heading title="My agent">
            Manage your connection, search targets, and permissions.
          </Heading>
          <Link href="/onboarding/" className={secondary}>
            Change companion
          </Link>
          <AgentConnections />
          <SearchTargets />
          <Preferences mode="agent" showDefaultResume={false} />
        </section>
      )}
      {active !== "agent" && active !== "about" && (active !== "overview" || a.dirty) && (
        <div className={profileStyles.saveBar}>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">
              {a.dirty
                ? "Unsaved profile changes"
                : "Application profile settings"}
            </span>
            <p role="status" className="mt-1 text-xs text-board-muted">
              {a.feedback || "Identity, material selections, writing style, and job preferences save together."}
            </p>
          </div>
          <button
            className={secondary}
            disabled={a.busy || w.locked}
            onClick={a.reload}
          >
            Reload saved
          </button>
          <button
            className={primary}
            disabled={a.busy || w.locked || !a.dirty || !a.profile.name.trim()}
            onClick={a.saveProfile}
          >
            {a.busy ? "Saving…" : "Save application profile"}
          </button>
        </div>
      )}
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
