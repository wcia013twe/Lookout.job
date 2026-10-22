"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, secondary } from "./ui";
import {
  priorities,
  preferenceGroups,
  flexibilityOptions,
  careerFields,
  readField,
  updateField,
} from "../../lib/search-profile.mjs";

import TierLists from "./tierlists";
import RecruitingTargets from "./recruiting-targets";
import { ApplicationMaterials } from "./profile-settings";
import ProfileRuleCopy from "./profile-rule-copy";
import { errorMessage } from "./profile-types";
import { useApplicationProfile } from "./application-profile-context";
function SearchProfileEditor() {
  const w = useWorkspace();
  const { profile, patch, busy, setFeedback } = useApplicationProfile();
  const [showLegacy, setShowLegacy] = useState(false);
  const [undo, setUndo] = useState<{
    id: string;
    prompt: string;
    after: string;
  } | null>(null);
  function change(heading: string, key: string, value: string) {
    try {
      const prompt = updateField(profile.prompt, heading, key, value);
      setUndo({ id: profile.id, prompt: profile.prompt, after: prompt });
      patch({ prompt });
      setFeedback(`${key} updated. Save the application profile when ready.`);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }
  function textField(
    heading: string,
    key: string,
    placeholder: string,
    multiline = false,
  ) {
    const field = readField(profile.prompt, heading, key);
    return (
      <Field
        label={
          heading === "Profile evaluation" ? "Rules for this profile" : key
        }
        key={key}
      >
        {multiline ? (
          <textarea
            className={control}
            rows={3}
            value={field.value}
            disabled={field.conflict || busy}
            placeholder={placeholder}
            onChange={(e) => change(heading, key, e.target.value)}
          />
        ) : (
          <input
            className={control}
            value={field.value}
            disabled={field.conflict || busy}
            placeholder={placeholder}
            onChange={(e) => change(heading, key, e.target.value)}
          />
        )}
        {field.conflict && (
          <span className="text-sm text-board-muted">
            Resolve duplicate {key} lines in Advanced instructions.
          </span>
        )}
      </Field>
    );
  }
  function selectTierList(id: string) {
    try {
      const list = w.state.workflow.tierLists.find(
        (item: { id: string }) => item.id === id,
      );
      let prompt = updateField(
        profile.prompt,
        "Company priorities",
        "Tier list ID",
        id,
      );
      prompt = updateField(
        prompt,
        "Company priorities",
        "Tier list name",
        list?.name || "",
      );
      setUndo({ id: profile.id, prompt: profile.prompt, after: prompt });
      patch({ prompt });
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }
  const tierField = readField(
    profile.prompt,
    "Company priorities",
    "Tier list ID",
  );
  const tierExists = w.state.workflow.tierLists.some(
    (list: { id: string }) => list.id === tierField.value,
  );
  return (
    <Section title="Job preferences">
      <p className="mb-5 max-w-prose text-sm text-board-muted">
        What makes a role right for {profile.name}? These preferences belong to
        this application profile.
      </p>
      <label className="mb-6 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          disabled={busy}
          checked={profile.active}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        Include this profile in job searches
      </label>
      <ApplicationMaterials />
      <h3 className="mt-8 mb-2 text-lg font-semibold">
        Criteria for this profile
      </h3>
      <p className="mb-5 text-sm text-board-muted">
        These apply to every recruiting target in {profile.name}.
      </p>
      <section
        aria-labelledby="preference-priority-heading"
        className="mb-7 border-t border-board-line pt-5"
      >
        <h3 id="preference-priority-heading" className="text-lg font-semibold">
          Priority &amp; flexibility
        </h3>
        <p className="mt-2 max-w-prose text-sm text-board-muted">
          Set a priority beside each criterion. Required means a must-have;
          Preferred favors a match; Flexible allows a tradeoff. Blank means you
          have not specified a priority. Missing evidence in a listing still
          needs verification.
        </p>
      </section>
      <div className="space-y-7">
        <RecruitingTargets />
        {preferenceGroups.map((group) => (
          <details
            key={group.title}
            className="border-t border-board-line py-3"
            open={group.title === "Roles & experience"}
          >
            <summary className="text-base font-semibold">
              {group.title}
              <span className="ml-3 text-sm font-normal text-board-muted">
                {group.fields
                  .map(
                    ([key, , heading]) =>
                      readField(profile.prompt, heading || group.heading, key)
                        .value,
                  )
                  .filter(Boolean)
                  .join(" · ") || "Not specified"}
              </span>
            </summary>
            <p className="mb-4 text-xs text-board-muted">
              List multiple choices separated by commas, or describe your
              preference.
            </p>
            <div className="space-y-5">
              {group.fields.map(([key, placeholder, heading]) => {
                const strength = readField(
                  profile.prompt,
                  "Priority & flexibility",
                  key,
                );
                return (
                  <div
                    key={key}
                    className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_190px]"
                  >
                    {textField(heading || group.heading, key, placeholder)}
                    <Field label={`${key} priority`}>
                      <select
                        className={control}
                        disabled={strength.conflict || busy}
                        value={strength.value}
                        onChange={(e) =>
                          change("Priority & flexibility", key, e.target.value)
                        }
                      >
                        <option value="">Not specified</option>
                        {flexibilityOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      {strength.conflict && (
                        <span className="text-sm text-board-muted">
                          Resolve duplicate priority lines in Advanced
                          instructions.
                        </span>
                      )}
                    </Field>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        <details className="border-t border-board-line py-3">
          <summary className="text-base font-semibold">What you value</summary>

          <p className="mb-4 max-w-prose text-sm text-board-muted">
            These guide how your agent weighs opportunities.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {priorities.map((key) => {
              const field = readField(
                profile.prompt,
                "How to Evaluate Opportunities",
                key,
              );
              return (
                <Field label={key} key={key}>
                  <select
                    className={control}
                    value={field.value}
                    disabled={field.conflict || busy}
                    onChange={(e) =>
                      change(
                        "How to Evaluate Opportunities",
                        key,
                        e.target.value,
                      )
                    }
                  >
                    <option value="">No preference</option>
                    <option>Important</option>
                    <option>Very important</option>
                  </select>
                  {field.conflict && (
                    <span className="text-sm text-board-muted">
                      Resolve duplicate lines in Advanced instructions.
                    </span>
                  )}
                </Field>
              );
            })}
          </div>
        </details>
        <details className="border-t border-board-line py-3" open>
          <summary className="text-base font-semibold">
            Company priorities
          </summary>

          <p className="mb-4 max-w-prose text-sm text-board-muted">
            Associate a tier list with this search profile. Tiers guide company
            priority; the specific role and team still determine fit. Editing a
            list affects every profile that uses it.
          </p>
          <Field label="Tier list for this profile">
            <select
              className={control}
              disabled={busy || tierField.conflict}
              value={tierField.value}
              onChange={(e) => selectTierList(e.target.value)}
            >
              <option value="">No tier list selected</option>
              {tierField.value && !tierExists && (
                <option value={tierField.value}>
                  Previously selected list unavailable
                </option>
              )}
              {w.state.workflow.tierLists.map(
                (list: { id: string; name: string }) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ),
              )}
            </select>
            {tierField.conflict && (
              <span className="text-sm text-board-muted">
                Resolve duplicate tier-list lines in Advanced instructions.
              </span>
            )}
          </Field>
          <div className="mt-4">
            <TierLists
              selectedListId={tierExists ? tierField.value : undefined}
              onSelectList={selectTierList}
            />
          </div>
        </details>
      <section
        aria-labelledby="profile-evaluation-heading"
        className="mb-7 border-t border-board-line pt-5"
      >
        <h3 id="profile-evaluation-heading" className="text-lg font-semibold">
          Profile rules
        </h3>
        <p className="mt-2 mb-4 max-w-prose text-sm text-board-muted">
          Only for {profile.name}. Describe how your agent should work and what
          makes an opportunity worth pursuing. Other profiles have their own
          rules.
        </p>
        {textField(
          "Profile evaluation",
          "Rules",
          "For example: verify uncertain facts, prioritize strong systems teams, and explain any tradeoffs before recommending a role.",
          true,
        )}
        {(w.user || w.demo) && (
          <details
            className="mt-3"
            onToggle={(e) => setShowLegacy(e.currentTarget.open)}
          >
            <summary className="text-sm font-medium">
              Copy previous rules
            </summary>
            {showLegacy && <ProfileRuleCopy />}
          </details>
        )}
        <details className="border-t border-board-line py-3">
          <summary className="text-base font-semibold">
            Career goals &amp; tradeoffs
          </summary>

          <p className="mb-4 max-w-prose text-sm text-board-muted">
            Explain why a role is worth pursuing and what upside would justify a
            compromise.
          </p>
          <div className="space-y-4">
            {careerFields.map((key) =>
              textField(
                "Career goals & tradeoffs",
                key,
                key === "Career goals"
                  ? "What do you want this next role to help you achieve?"
                  : "What would justify lower pay, relocation, or a change in timing?",
                true,
              ),
            )}
          </div>
        </details>
      </section>
        <details className="border-t border-board-line pt-5">
          <summary className="min-h-11 text-base font-semibold">
            Advanced instructions
          </summary>
          <p className="mb-3 mt-3 max-w-prose text-sm text-board-muted">
            These fields edit the same instructions your agent reads. Additional
            prose and existing preferences are preserved. Submission permission
            is managed in My agent.
          </p>
          <textarea
            aria-label={`${profile.name} preference prompt`}
            spellCheck
            className={`${control} min-h-[22rem] resize-y leading-relaxed`}
            disabled={busy}
            value={profile.prompt}
            onChange={(e) => {
              setUndo(null);
              patch({ prompt: e.target.value });
            }}
          />
        </details>
      </div>
      {undo?.id === profile.id && undo.after === profile.prompt && (
        <button
          type="button"
          className={`${secondary} mt-4`}
          disabled={busy}
          onClick={() => {
            patch({ prompt: undo.prompt });
            setUndo(null);
          }}
        >
          Undo last adjustment
        </button>
      )}
    </Section>
  );
}
export default function SearchProfiles() {
  const { profile } = useApplicationProfile();
  return <SearchProfileEditor key={profile.id} />;
}
