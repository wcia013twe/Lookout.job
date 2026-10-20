"use client";
import { useState } from "react";
import Link from "next/link";
import ProfileSurface, { profileStyles } from "./profile-surface";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, control, Field } from "./ui";
import ProfileEditor from "./profile-editor";
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
  AccountAssignments,
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
    a = useApplicationProfile(),
    profile = w.state.workflow.profile;
  const [active, setActive] = useState<ProfileSection>("overview"),
    [visited, setVisited] = useState<ProfileSection[]>([]);
  function select(id: ProfileSection) {
    setActive(id);
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }
  const email = a.field("Application identity", "Application email").value;
  const resume = w.state.workflow.resumes.find(
    (r: { id: string }) =>
      r.id === a.field("Application materials", "Default resume ID").value,
  );
  const summaries: [ProfileSection, string, string, string][] = [
    [
      "about",
      "About me",
      profile.verified
        ? "Background checked by you"
        : "Background needs your review",
      email
        ? `Application email: ${email}`
        : "Set your application email and account assignments",
    ],
    [
      "kit",
      "Application kit",
      resume ? resume.name : "Choose a resume for this profile",
      `${w.state.workflow.savedAnswers.length} saved answers in your shared library`,
    ],
    [
      "preferences",
      "Job preferences",
      a.profile.active ? "Included in job searches" : "Search paused",
      a.field("Role preferences", "Roles").value ||
        "Define the roles and tradeoffs that matter to you",
    ],
  ];
  return (
    <ProfileSurface>
      <Heading title="My Profile">
        Your background, your materials, your next move.
      </Heading>
      {active !== "agent" && <ProfileSwitcher />}
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
      {active === "overview" && (
        <div className={profileStyles.overview}>
          <div className={profileStyles.identityHeader}>
            <div className={profileStyles.initials} aria-hidden="true">
              {(profile.name || "Your profile")
                .split(" ")
                .map((v: string) => v[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <p className="text-xs text-board-muted">SHARED BACKGROUND</p>
              <h2 className="mt-1 text-xl font-bold">
                {profile.name || "Your profile"}
              </h2>
              <p className="mt-1 text-sm text-board-muted">
                {[profile.headline, profile.location]
                  .filter(Boolean)
                  .join(" · ") ||
                  "Add your professional background in About me."}
              </p>
            </div>
            <button
              className={`${secondary} sm:ml-auto`}
              onClick={() => select("about")}
            >
              Edit background
            </button>
          </div>
          <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Ready for your next application?
            </h2>
            <span className="text-sm text-board-muted">{a.profile.name}</span>
          </div>
          <div className={profileStyles.readinessList}>
            {summaries.map(([id, title, status, description]) => (
              <button
                type="button"
                key={id}
                className={profileStyles.readinessRow}
                onClick={() => select(id)}
              >
                <span className="font-semibold">{title}</span>
                <span className="min-w-0">
                  <span className="block text-sm">{status}</span>
                  <span className="mt-1 block text-xs text-board-muted">
                    {description}
                  </span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <div className={profileStyles.overviewBottom}>
            <section>
              <h3 className="font-semibold">Assigned accounts</h3>
              <p className="mt-2 text-sm text-board-muted">
                Managed by your agent
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                {["Email account", "Document account", "Outreach identity"].map(
                  (key) => (
                    <div key={key}>
                      <dt className="text-xs text-board-muted">{key}</dt>
                      <dd className="mt-1 break-words">
                        {a.field("Application identity", key).value ||
                          "Not assigned"}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
              <button
                className={`${secondary} mt-5`}
                onClick={() => select("about")}
              >
                View assignments
              </button>
            </section>
            <section>
              <h3 className="font-semibold">Your writing voice</h3>
              {[
                ["Employer questions", "Employer answer writing"],
                ["Outreach", "Outreach writing"],
              ].map(([title, heading]) => (
                <div key={heading} className="mt-4">
                  <p className="text-xs text-board-muted">{title}</p>
                  <p className="mt-1 text-sm">
                    {[
                      a.field(heading, "Tone").value,
                      a.field(heading, "Length").value,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No style configured"}
                  </p>
                </div>
              ))}
              <button
                className={`${secondary} mt-5`}
                onClick={() => select("kit")}
              >
                Edit writing styles
              </button>
            </section>
          </div>
          <Link
            href="/onboarding/"
            className="mt-6 inline-flex min-h-11 items-center text-sm text-board-muted underline underline-offset-4"
          >
            {profile.name ? "Revisit guided setup" : "Start guided setup"}
          </Link>
        </div>
      )}
      {visited.includes("about") && (
        <section
          className={profileStyles.panel}
          hidden={active !== "about"}
          aria-label="About me"
        >
          <div className={profileStyles.sectionIntro}>
            <h2>About me</h2>
            <p>
              Your application identity here. Your career background shared
              across profiles.
            </p>
          </div>
          <AccountAssignments />
          <div className={profileStyles.sharedHeading}>
            <span>Shared across application profiles</span>
            <p>Changes below update your background everywhere.</p>
          </div>
          <ProfileEditor />
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
      {active !== "agent" && (active !== "overview" || a.dirty) && (
        <div className={profileStyles.saveBar}>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold">
              {a.dirty
                ? "Unsaved profile changes"
                : "Application profile settings"}
            </span>
            <p role="status" className="mt-1 text-xs text-board-muted">
              {a.feedback ||
                "Identity, material selections, writing style, and job preferences save together."}
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
