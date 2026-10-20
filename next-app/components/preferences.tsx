"use client";
import type { ResumeRecord, TierListReference } from "./profile-types";
import SearchProfiles from "./search-profiles";
import { useState } from "react";
import QuietDemoPreview from "./quiet-demo-preview";
import { useQuietSettings } from "../lib/quiet-settings";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, Notice } from "./ui";
export default function Preferences({
  showDefaultResume = true,
  mode = "all",
}: {
  showDefaultResume?: boolean;
  mode?: "all" | "search" | "agent";
}) {
  const w = useWorkspace(),
    p = w.state.workflow.searchPreferences || {};
  const [feedback, setFeedback] = useState("");
  const {
    quiet,
    save: saveQuiet,
    busy: quietBusy,
    error: quietError,
    reload: reloadQuiet,
  } = useQuietSettings();
  function patch(fields: Record<string, unknown>) {
    w.store.set("workflow.searchPreferences", { ...p, ...fields });
    setFeedback(
      w.user
        ? "Preference saved. Syncing for Muse."
        : "Preference saved in this browser. Sign in to share it with Muse.",
    );
  }
  function policy(key: string, fields: Record<string, unknown>) {
    patch({
      reviewPolicy: {
        ...p.reviewPolicy,
        [key]: { ...p.reviewPolicy?.[key], ...fields },
      },
    });
  }
  return (
    <>
      {mode !== "search" && (
        <>
          <Section title="Muse updates">
            <p className="mb-5 max-w-prose text-sm text-board-muted">
              Keep applying under your application policy. Choose when Muse
              should share routine progress; decisions with an approaching
              deadline can interrupt a digest.
            </p>
            <fieldset
              disabled={quietBusy}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="Update frequency">
                <select
                  className={control}
                  value={quiet.cadence}
                  onChange={(e) =>
                    saveQuiet({ ...quiet, cadence: e.target.value })
                  }
                >
                  <option value="immediate">Immediate updates</option>
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly pack</option>
                </select>
              </Field>
              <Field label="Time zone">
                <input
                  className={control}
                  aria-describedby="quiet-timezone-help"
                  key={quiet.timezone}
                  defaultValue={quiet.timezone}
                  placeholder="America/New_York"
                  onBlur={(e) => {
                    const timezone = e.target.value.trim();
                    try {
                      new Intl.DateTimeFormat("en", {
                        timeZone: timezone,
                      }).format();
                    } catch {
                      setFeedback(
                        "Enter a valid time zone, such as America/New_York.",
                      );
                      return;
                    }
                    if (!timezone) {
                      setFeedback(
                        "Enter a time zone, such as America/New_York.",
                      );
                      return;
                    }
                    saveQuiet({ ...quiet, timezone });
                  }}
                />
                <span
                  id="quiet-timezone-help"
                  className="text-xs text-board-muted"
                >
                  Use a region/city time zone.
                </span>
              </Field>
              {quiet.cadence !== "immediate" && (
                <Field label="Digest time">
                  <select
                    className={control}
                    value={quiet.digestHour}
                    onChange={(e) =>
                      saveQuiet({
                        ...quiet,
                        digestHour: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {quiet.cadence === "weekly" && (
                <Field label="Weekly pack day">
                  <select
                    className={control}
                    value={quiet.digestDay}
                    onChange={(e) =>
                      saveQuiet({ ...quiet, digestDay: Number(e.target.value) })
                    }
                  >
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Interrupt when action is due within">
                <select
                  className={control}
                  value={quiet.urgentDeadlineHours}
                  onChange={(e) =>
                    saveQuiet({
                      ...quiet,
                      urgentDeadlineHours: Number(e.target.value),
                    })
                  }
                >
                  {[6, 12, 24, 48, 72, 168].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours === 168 ? "One week" : `${hours} hours`}
                    </option>
                  ))}
                </select>
              </Field>
            </fieldset>
            {quietBusy && <Notice>Saving update settings…</Notice>}
            {quietError && (
              <div>
                <Notice>{quietError}</Notice>
                <button type="button" className={primary} onClick={reloadQuiet}>
                  Reload update settings
                </button>
              </div>
            )}
            <p className="mt-4 max-w-prose text-sm text-board-muted">
              These settings guide your connected agent. Delivery and timing
              depend on its notification channel and scheduled runs.
            </p>
            <Notice>{feedback}</Notice>
            {w.demo && <QuietDemoPreview />}
          </Section>
          <Section title="Application automation">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-board-accent"
                checked={p.autoSubmitApproved === true}
                onChange={(e) =>
                  patch({ autoSubmitApproved: e.target.checked })
                }
              />
              Auto-apply routine matches
            </label>
            <p className="mt-3 text-sm text-board-muted">
              Important matches, missing facts, unfamiliar answers, and
              uncertain outcomes require review. Submission needs a connected
              supported runner.
            </p>
            <div className="mt-5 space-y-5">
              {[
                ["fullTime", "FT", "Full-time"],
                ["internship", "Internship", "Internships"],
              ].map(([key, type, label]) => (
                <div key={key} className="grid gap-3 sm:grid-cols-2">
                  <Field label={`${label} company list`}>
                    <select
                      className={control}
                      value={p.reviewPolicy?.[key]?.tierListId || ""}
                      onChange={(e) =>
                        policy(key, { tierListId: e.target.value || null })
                      }
                    >
                      <option value="">Automatic (one matching list)</option>
                      {w.state.workflow.tierLists
                        .filter(
                          (l: TierListReference) =>
                            !l.employmentType || l.employmentType === type,
                        )
                        .map((l: TierListReference) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={`${label} review threshold`}>
                    <select
                      className={control}
                      value={p.reviewPolicy?.[key]?.threshold || "A"}
                      onChange={(e) =>
                        policy(key, { threshold: e.target.value })
                      }
                    >
                      {["S", "A", "B", "C", "D", "all"].map((t) => (
                        <option value={t} key={t}>
                          {t === "all"
                            ? "Review every match"
                            : `${t} tier and above`}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ))}
              {showDefaultResume && (
                <Field label="Default private PDF resume">
                  <select
                    className={control}
                    value={p.defaultResumeId || ""}
                    onChange={(e) =>
                      patch({ defaultResumeId: e.target.value || null })
                    }
                  >
                    <option value="">Choose a private uploaded PDF</option>
                    {w.state.workflow.resumes
                      .filter(
                        (r: ResumeRecord) =>
                          /\.pdf$/i.test(r.objectPath || "") && r.contentHash,
                      )
                      .map((r: ResumeRecord) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </div>
          </Section>
        </>
      )}
      {mode !== "agent" && (
        <>
          <SearchProfiles />
        </>
      )}
    </>
  );
}
