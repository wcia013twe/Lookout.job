"use client";
import type { ResumeRecord } from "./profile-types";
import SearchProfiles from "./search-profiles";
import ProfileAutomation from "./profile-automation";
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
  return (
    <>
      {mode !== "search" && (
        <>
          <Section title="Muse updates" help="Keep applying under your application policy. Choose when Muse should share routine progress. Decisions with an approaching deadline can interrupt a digest. These settings guide your connected agent; delivery and timing depend on its notification channel and scheduled runs. Use a region/city time zone, such as America/New_York.">
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

            <Notice>{feedback}</Notice>
            {w.demo && <QuietDemoPreview />}
          </Section>
          <ProfileAutomation />
          {showDefaultResume && <Section title="Default submission resume">
            <Field label="Default private PDF resume"><select className={control} value={p.defaultResumeId||""} onChange={e=>patch({defaultResumeId:e.target.value||null})}><option value="">Choose a private uploaded PDF</option>{w.state.workflow.resumes.filter((r:ResumeRecord)=>/\.pdf$/i.test(r.objectPath||"")&&r.contentHash).map((r:ResumeRecord)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          </Section>}

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
