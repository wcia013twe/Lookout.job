"use client";
import { useState } from "react";
import { useApplicationProfile } from "./application-profile-context";
import { useWorkspace } from "../lib/workspace";
import { Field, control, secondary, Section } from "./ui";
import { profileStyles as styles } from "./profile-surface";
export function ProfileSwitcher() {
  const a = useApplicationProfile();
  const [creating, setCreating] = useState(false),
    [name, setName] = useState("");
  return (
    <section
      className={styles.profilePicker}
      aria-label="Application profile selection"
    >
      <div className={styles.pickerMain}>
        <Field label="Application profile">
          <select
            className={control}
            value={a.profile.id}
            disabled={a.busy}
            onChange={(e) => a.select(e.target.value)}
          >
            {a.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? "" : " · Paused"}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className={secondary}
          disabled={a.busy}
          onClick={() => setCreating(!creating)}
        >
          {creating ? "Cancel" : "New profile"}
        </button>
        <button
          type="button"
          className={secondary}
          disabled={a.busy}
          onClick={() => a.create(`${a.profile.name} copy`, true)}
        >
          Duplicate
        </button>
      </div>
      <p className="mt-3 text-xs text-board-muted">
        One Lookout account. Separate application identities, materials, and job
        preferences.
      </p>
      {creating && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.create(name);
            setName("");
            setCreating(false);
          }}
        >
          <Field label="New application profile name">
            <input
              className={control}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              placeholder="Full-time engineering, internships…"
            />
          </Field>
          <button className={secondary} disabled={!name.trim()}>
            Create profile
          </button>
        </form>
      )}
    </section>
  );
}
export function AccountAssignments() {
  const a = useApplicationProfile();
  const fields = [
    ["Application email", "email", "The email employers should use"],
    ["Email account", "text", "Personal Gmail · candidate@example.com"],
    ["Document account", "text", "Personal Google Drive"],
    ["Outreach identity", "text", "University Outlook · candidate@example.edu"],
  ];
  return (
    <Section title="Accounts & identity">
      <p className="mb-5 max-w-prose text-sm text-board-muted">
        Assigned to {a.profile.name}. Your agent manages access to these
        accounts; Lookout records which ones to use.
      </p>
      <div className="mb-5">
        <Field label="Application profile name">
          <input
            className={control}
            value={a.profile.name}
            maxLength={80}
            disabled={a.busy}
            onChange={(e) => a.patch({ name: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map(([key, type, placeholder]) => (
          <Field key={key} label={key}>
            <input
              className={control}
              type={type}
              placeholder={placeholder}
              value={a.field("Application identity", key).value}
              disabled={a.busy || a.field("Application identity", key).conflict}
              onChange={(e) =>
                a.change("Application identity", key, e.target.value)
              }
            />
          </Field>
        ))}
      </div>
      <p className="mt-4 text-xs text-board-muted">
        Assignments are instructions for your agent, not verified connections.
        Application email does not change your Lookout sign-in.
      </p>
    </Section>
  );
}
export function ApplicationMaterials() {
  const a = useApplicationProfile(),
    w = useWorkspace();
  const id = a.field("Application materials", "Default resume ID").value;
  return (
    <Section title="Materials for this profile">
      <p className="mb-5 text-sm text-board-muted">
        Choose from your shared library. Each application profile keeps its own
        selections.
      </p>
      <Field label="Preferred resume">
        <select
          className={control}
          disabled={a.busy}
          value={id}
          onChange={(e) =>
            a.change(
              "Application materials",
              "Default resume ID",
              e.target.value,
            )
          }
        >
          <option value="">No profile resume selected</option>
          {id &&
            !w.state.workflow.resumes.some(
              (r: { id: string }) => r.id === id,
            ) && (
              <option value={id}>Previously selected resume unavailable</option>
            )}
          {w.state.workflow.resumes.map((r: { id: string; name: string }) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="mt-3 text-xs text-board-muted">
        A profile selection guides preparation. Existing application review and
        submission permissions still apply.
      </p>
      <fieldset className="mt-6">
        <legend className="mb-3 text-sm font-semibold">
          Saved answers to use
        </legend>
        <p className="mb-3 text-xs text-board-muted">
          Select answers for this profile. Each answer retains its own review
          and reuse policy.
        </p>
        {w.state.workflow.savedAnswers.length ? (
          w.state.workflow.savedAnswers.map(
            (answer: { id: string; question: string }) => {
              const selected = a
                .field("Application materials", "Saved answer IDs")
                .value.split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              return (
                <label
                  key={answer.id}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(answer.id)}
                    disabled={a.busy}
                    onChange={(e) =>
                      a.change(
                        "Application materials",
                        "Saved answer IDs",
                        (e.target.checked
                          ? [...selected, answer.id]
                          : selected.filter((id) => id !== answer.id)
                        ).join(", "),
                      )
                    }
                  />
                  {answer.question}
                </label>
              );
            },
          )
        ) : (
          <p className="text-sm text-board-muted">
            Add an employer answer below to select it here.
          </p>
        )}
      </fieldset>
    </Section>
  );
}
const channels = [
  {
    heading: "Employer answer writing",
    title: "Employer questions",
    description:
      "How you sound when answering an employer’s application questions.",
  },
  {
    heading: "Outreach writing",
    title: "Outreach",
    description:
      "How you introduce yourself to recruiters, referrals, and potential teammates.",
  },
];
export function WritingStyles() {
  const a = useApplicationProfile();
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <Section title="Writing style">
      <p className="mb-6 text-sm text-board-muted">
        A separate voice for each kind of writing, saved with {a.profile.name}.
      </p>
      <div className={styles.writingGrid}>
        {channels.map((c) => (
          <div key={c.heading} className={styles.writingBlock}>
            <h3 className="text-base font-semibold">{c.title}</h3>
            <p className="mt-2 mb-5 text-sm text-board-muted">
              {c.description}
            </p>
            <div className="space-y-4">
              {[
                [
                  "Tone",
                  [
                    "Professional & direct",
                    "Warm & conversational",
                    "Confident & understated",
                    "Formal",
                  ],
                ],
                ["Length", ["Brief", "Balanced", "Detailed"]],
              ].map(([key, values]) => (
                <Field
                  key={key as string}
                  label={`${c.title} ${String(key).toLowerCase()}`}
                >
                  <select
                    className={control}
                    value={a.field(c.heading, key as string).value}
                    disabled={a.busy}
                    onChange={(e) =>
                      a.change(c.heading, key as string, e.target.value)
                    }
                  >
                    <option value="">No preference</option>
                    {(values as string[]).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              ))}
              <Field label={`${c.title} custom guidance`}>
                <textarea
                  rows={3}
                  className={control}
                  value={a.field(c.heading, "Guidance").value}
                  disabled={a.busy}
                  onChange={(e) =>
                    a.change(c.heading, "Guidance", e.target.value)
                  }
                  placeholder={
                    c.heading === "Outreach writing"
                      ? "Lead with why I’m contacting them. Avoid flattery."
                      : "Use concrete evidence. Avoid exaggerated enthusiasm."
                  }
                />
              </Field>
              <button
                type="button"
                className={secondary}
                onClick={() =>
                  setPreview(preview === c.heading ? null : c.heading)
                }
              >
                Preview style brief
              </button>
              {preview === c.heading && (
                <div className="border-t border-board-line pt-4 text-sm leading-relaxed">
                  <p className="font-semibold">
                    Instructions your agent will receive
                  </p>
                  <p className="mt-2">
                    {a.field(c.heading, "Tone").value || "Use a natural tone"}.{" "}
                    {a.field(c.heading, "Length").value ||
                      "Choose a suitable length"}
                    .
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {a.field(c.heading, "Guidance").value ||
                      "No additional writing guidance."}
                  </p>
                  <p className="mt-3 text-xs text-board-muted">
                    This previews saved guidance, not generated writing. Facts
                    and answer-review requirements still apply.
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
