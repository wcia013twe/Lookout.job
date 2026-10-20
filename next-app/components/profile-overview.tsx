"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { useApplicationProfile } from "./application-profile-context";
import ProfileIcon, { type ProfileIconName } from "./profile-icon";
import { profileStyles as styles } from "./profile-surface";
import { secondary } from "./ui";
import {
  profileOverviewStats,
  profileDisplayName,
} from "../../lib/profile-overview.mjs";
export default function ProfileOverview({
  onSelect,
}: {
  onSelect: (section: "about" | "kit" | "preferences") => void;
}) {
  const w = useWorkspace(),
    a = useApplicationProfile(),
    profile = w.state.workflow.profile;
  const displayName = profileDisplayName(
    profile,
    a.field("Application identity", "Preferred first name").value,
    a.field("Application identity", "Preferred last name").value,
  );
  const stats = profileOverviewStats(w.state);
  const email = a.field("Application identity", "Application email").value;
  const resume = w.state.workflow.resumes.find(
    (r: { id: string }) =>
      r.id === a.field("Application materials", "Default resume ID").value,
  );
  const summaries: {
    section: "about" | "kit" | "preferences";
    icon: ProfileIconName;
    title: string;
    status: string;
    detail: string;
  }[] = [
    {
      section: "about",
      icon: "user",
      title: "About me",
      status: profile.verified
        ? "Background reviewed"
        : "Review your background",
      detail: email || "Add your application email",
    },
    {
      section: "kit",
      icon: "file",
      title: "Application kit",
      status: resume ? resume.name : "Choose your resume",
      detail: `${w.state.workflow.resumes.length} resumes · ${w.state.workflow.savedAnswers.length} saved answers in your shared library`,
    },
    {
      section: "preferences",
      icon: "sliders",
      title: "Job preferences",
      status: a.profile.active ? "Search active" : "Search paused",
      detail:
        a.field("Role preferences", "Roles").value ||
        "Choose your roles, priorities, and tradeoffs",
    },
  ];
  const metrics: {
    key: keyof typeof stats;
    label: string;
    icon: ProfileIconName;
  }[] = [
    { key: "tracked", label: "Tracked roles", icon: "briefcase" },
    { key: "applied", label: "Applications made", icon: "send" },
    { key: "interviewing", label: "Active interviews", icon: "conversation" },
    { key: "offers", label: "Offers", icon: "award" },
  ];
  const assignments: { key: string; icon: ProfileIconName }[] = [
    { key: "Email account", icon: "mail" },
    { key: "Document account", icon: "file" },
    { key: "Outreach identity", icon: "send" },
  ];
  return (
    <div className={styles.overview}>
      <section className={styles.accountHeader} aria-label="Account overview">
        <div className={styles.accountAvatar} aria-hidden="true">
          {displayName ? (
            displayName
              .split(" ")
              .map((v: string) => v[0])
              .slice(0, 2)
              .join("")
          ) : (
            <ProfileIcon name="user" width={28} height={28} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {displayName || "Your account overview"}
          </h2>
          <p className="mt-1 text-sm text-board-muted">
            {profile.headline || "Your job search, at a glance."}
          </p>
          <div className={styles.identityMeta}>
            {profile.location && (
              <span>
                <ProfileIcon name="location" width={15} height={15} />
                {profile.location}
              </span>
            )}
            <span>
              <ProfileIcon
                name={profile.verified ? "check" : "user"}
                width={15}
                height={15}
              />
              {profile.verified
                ? "Background reviewed by you"
                : "Background needs review"}
            </span>
          </div>
        </div>
        <button className={secondary} onClick={() => onSelect("about")}>
          <ProfileIcon name="pen" width={16} height={16} />
          <span className="ml-2">Edit background</span>
        </button>
      </section>
      <section
        aria-label="Account-wide job search statistics"
        className={styles.accountStats}
      >
        <div className={styles.statsHeading}>
          <h3>Job search activity</h3>
          <span>Across your Lookout account</span>
        </div>
        <dl className={styles.statsGrid}>
          {metrics.map((m) => (
            <div key={m.key} className={styles.stat}>
              <div className={styles.statLabel}>
                <ProfileIcon name={m.icon} />
                <dt>{m.label}</dt>
              </div>
              <dd>{stats[m.key]}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.statsNote}>
          Based on recorded progress, including updates reported by you or your
          agent.
        </p>
      </section>
      <div className={styles.profileOverviewHeading}>
        <div>
          <h2 className="text-lg font-semibold">Your application profile</h2>
          <p className="mt-1 text-sm text-board-muted">{a.profile.name}</p>
        </div>
        <span className={styles.profileStatus}>
          <span
            aria-hidden="true"
            className={a.profile.active ? styles.activeDot : styles.pausedDot}
          />
          {a.profile.active ? "Search active" : "Search paused"}
        </span>
      </div>
      <div className={styles.readinessList}>
        {summaries.map((s) => (
          <button
            type="button"
            key={s.section}
            className={styles.overviewReadiness}
            onClick={() => onSelect(s.section)}
          >
            <span className={styles.rowIcon}>
              <ProfileIcon name={s.icon} />
            </span>
            <span className={styles.readinessLabel}>{s.title}</span>
            <span className={styles.readinessContent}>
              <span className="block text-sm font-medium">{s.status}</span>
              <span className="mt-1 block text-xs text-board-muted">
                {s.detail}
              </span>
            </span>
            <ProfileIcon name="arrow" width={18} height={18} />
          </button>
        ))}
      </div>
      <div className={styles.overviewBottom}>
        <section className={styles.overviewDetail}>
          <div className={styles.detailHeading}>
            <ProfileIcon name="mail" />
            <h3>Assigned accounts</h3>
          </div>
          <p className="mt-2 text-sm text-board-muted">
            For {a.profile.name} · Access managed by your agent
          </p>
          <dl className={styles.accountAssignments}>
            {assignments.map(({ key, icon }) => (
              <div key={key}>
                <span className={styles.assignmentIcon}>
                  <ProfileIcon name={icon} width={18} height={18} />
                </span>
                <div className="min-w-0">
                  <dt>{key}</dt>
                  <dd>
                    {a.field("Application identity", key).value ||
                      "Not assigned"}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <button
            className={styles.detailLink}
            onClick={() => onSelect("about")}
          >
            Manage assignments
            <ProfileIcon name="arrow" width={16} height={16} />
          </button>
        </section>
        <section className={styles.overviewDetail}>
          <div className={styles.detailHeading}>
            <ProfileIcon name="pen" />
            <h3>Your writing voice</h3>
          </div>
          <p className="mt-2 text-sm text-board-muted">
            A voice for each kind of conversation.
          </p>
          <dl className={styles.accountAssignments}>
            {[
              ["Employer questions", "Employer answer writing", "conversation"],
              ["Outreach", "Outreach writing", "send"],
            ].map(([title, heading, icon]) => (
              <div key={heading}>
                <span className={styles.assignmentIcon}>
                  <ProfileIcon
                    name={icon as ProfileIconName}
                    width={18}
                    height={18}
                  />
                </span>
                <div className="min-w-0">
                  <dt>{title}</dt>
                  <dd>
                    {[
                      a.field(heading, "Tone").value,
                      a.field(heading, "Length").value,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No style configured"}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <button className={styles.detailLink} onClick={() => onSelect("kit")}>
            Edit writing styles
            <ProfileIcon name="arrow" width={16} height={16} />
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
  );
}
