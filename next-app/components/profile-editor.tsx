"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from "react";
import { createProfileReview } from "../../lib/profile-review.mjs";
import rawSchema from "../../lib/profile-schema.js";
import { useWorkspace } from "../lib/workspace";
import ProfileIcon from "./profile-icon";
import { Field, control, primary, secondary, Notice, Section } from "./ui";
const labels: Record<string, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Shared contact email",
  phone: "Phone number",
  location: "City / location",
  linkedin: "LinkedIn URL",
  github: "GitHub URL",
  portfolio: "Portfolio URL",
  otherUrl: "Other URL",
  authorization: "Work authorization notes",
  headline: "Current title",
  currentEmployer: "Current employer",
  jobSearchStatus: "Job search status",
  skills: "Skills",
  preferredSkills: "Skills you prefer to use",
  languages: "Languages",
};
type EntryKind = "workExperience" | "education" | "projects";
type ProfileEntry = Record<string, string | boolean | undefined>;
type ProfileFacts = Record<string, unknown> & { verified?: boolean } & Partial<
    Record<EntryKind, ProfileEntry[]>
  >;
type ProfileSchema = {
  scalarFields: string[];
  schemas: Record<EntryKind, [string, string, string?, string?][]>;
};
const schema = rawSchema as ProfileSchema;
const sections: Record<string, string> = {
  workExperience: "Work experience",
  education: "Education",
  projects: "Projects & outside experience",
};
function EditableSection({ title, preview, children, initiallyEditing = false }: {
  title: string;
  preview: ReactNode;
  children: ReactNode;
  initiallyEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const editorId = useId();
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h4 className="min-w-0 break-words text-base font-semibold">{title}</h4>
        <button
          type="button"
          aria-label={editing ? `Close editor for ${title}` : `Edit ${title}`}
          aria-expanded={editing}
          aria-controls={editorId}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-board-muted hover:bg-board-tag hover:text-board-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent"
          onClick={() => setEditing(!editing)}
        >
          <ProfileIcon name={editing ? "check" : "pen"} />
        </button>
      </div>
      <div hidden={editing}>{preview}</div>
      <div id={editorId} hidden={!editing}>{children}</div>
    </div>
  );
}
function ProfileValues({ values }: { values: [string, unknown][] }) {
  const filled = values.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "" && value !== false);
  return filled.length ? (
    <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {filled.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-board-muted">{label}</dt>
          <dd className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">{Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : String(value)}</dd>
        </div>
      ))}
    </dl>
  ) : <p className="mt-2 text-sm text-board-muted">No details added yet.</p>;
}
export default function ProfileEditor() {
  const w = useWorkspace();
  const profile: ProfileFacts = w.state.workflow.profile;
  const [facts, setFacts] = useState(profile),
    [checked, setChecked] = useState(false),
    [feedback, setFeedback] = useState("");
  const review = useRef(createProfileReview());
  useEffect(() => {
    review.current.reset(profile, profile.verified);
    setFacts(profile);
    setChecked(profile.verified === true);
  }, [JSON.stringify(profile), w.user?.id]);
  function update(key: string, value: unknown) {
    review.current.invalidate();
    setFacts({ ...facts, [key]: value });
    setChecked(false);
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = { ...facts };
    for (const key of schema.scalarFields) {
      const element = form.elements.namedItem(key) as
        HTMLInputElement | HTMLTextAreaElement | null;
      if (element) {
        const value = element.value.trim();
        values[key] = value;
      }
    }
    const changed = schema.scalarFields.some((key) => {
      const current = Array.isArray(facts[key])
        ? (facts[key] as string[]).join("\n")
        : facts[key] || "";
      return values[key] !== String(current).trim();
    });
    const verified = checked && !changed && review.current.isReviewed(facts);
    w.store.set("workflow.profile", {
      ...values,
      verified,
    });
    setFeedback(
      verified
        ? "Profile saved and checked by you."
        : "Profile saved as unverified. Review changed facts before checking them.",
    );
  }
  return (
    <>
      <div className="mb-6">
        <h3 className="text-2xl font-semibold break-words">{String(facts.name || "Your background")}</h3>
        {!!(facts.headline || facts.currentEmployer) && <p className="mt-2 text-sm text-board-muted">{[facts.headline, facts.currentEmployer].filter(Boolean).join(" · ")}</p>}
        <p className="mt-2 text-sm text-board-muted">{String(facts.jobSearchStatus || "Job search status not specified")}</p>
      </div>
      <form autoComplete="on" onSubmit={save} className="space-y-5">
        {[
          {
            title: "Contact & name",
            keys: ["name", "firstName", "lastName", "email", "phone", "location"],
          },
          {
            title: "Professional summary",
            keys: ["headline", "currentEmployer", "jobSearchStatus"],
          },
          {
            title: "Professional links",
            keys: ["linkedin", "github", "portfolio", "otherUrl"],
          },
        ].map((group) => (
          <section key={group.title} className="rounded-xl border border-board-line bg-board-panel p-5 sm:p-6">
            <EditableSection title={group.title} preview={
              <ProfileValues values={group.keys.map(key => [labels[key], facts[key]])} />
            }>
            <fieldset>
              <legend className="sr-only">{group.title}</legend>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {schema.scalarFields
                  .filter((k) => group.keys.includes(k))
                  .map((key) => (
                    <Field label={labels[key]} key={key}>
                      <input
                        id={`profile-${key}`}
                        name={key}
                        className={control}
                        value={(facts[key] as string) || ""}
                        type={
                          key === "email"
                            ? "email"
                            : key === "phone"
                              ? "tel"
                              : [
                                    "linkedin",
                                    "github",
                                    "portfolio",
                                    "otherUrl",
                                  ].includes(key)
                                ? "url"
                                : "text"
                        }
                        autoComplete={
                          (
                            {
                              name: "name",
                              firstName: "given-name",
                              lastName: "family-name",
                              email: "email",
                              phone: "tel",
                              location: "address-level2",
                            } as Record<string, string>
                          )[key] || "off"
                        }
                        onChange={(e) => update(key, e.target.value)}
                      />
                    </Field>
                  ))}
              </div>
            </fieldset>
            </EditableSection>
          </section>
        ))}
        {(
          Object.entries(schema.schemas) as [
            EntryKind,
            ProfileSchema["schemas"][EntryKind],
          ][]
        ).map(([kind, fields]) => (
          <section className="rounded-xl border border-board-line bg-board-panel p-5 sm:p-6" key={kind}>
            <h3 className="text-lg font-semibold">
              {sections[kind]}{" "}
              <span className="text-sm font-normal text-board-muted">
                ({facts[kind]?.length || 0})
              </span>
            </h3>
            <fieldset>
              <legend className="sr-only">{sections[kind]}</legend>
              {(facts[kind] || []).map((entry, index) => (
                <div className="border-b border-board-line py-4" key={index}>
                  <EditableSection
                    title={`${entry.title || entry.degree || entry.name || "New entry"} · ${entry.company || entry.school || entry.institution || entry.role || "Details"}`}
                    initiallyEditing={Object.keys(entry).length === 0}
                    preview={<ProfileValues values={fields.map(([key, label]) => [label, entry[key]])} />}
                  >
                  <div className="pt-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {fields.map(
                        ([key, label, type = "text", autocomplete = "off"]) => (
                          <Field label={label} key={key}>
                            {type === "textarea" ? (
                              <textarea
                                className={control}
                                value={(entry[key] as string) || ""}
                                onChange={(e) =>
                                  update(
                                    kind,
                                    facts[kind]!.map((v, i) =>
                                      i === index
                                        ? { ...v, [key]: e.target.value }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              <input
                                className={
                                  type === "checkbox"
                                    ? "h-5 w-5 accent-board-accent"
                                    : control
                                }
                                type={type}
                                autoComplete={autocomplete}
                                checked={
                                  type === "checkbox"
                                    ? entry[key] === true
                                    : undefined
                                }
                                value={
                                  type === "checkbox"
                                    ? undefined
                                    : (entry[key] as string) || ""
                                }
                                onChange={(e) =>
                                  update(
                                    kind,
                                    facts[kind]!.map((v, i) =>
                                      i === index
                                        ? {
                                            ...v,
                                            [key]:
                                              type === "checkbox"
                                                ? e.target.checked
                                                : e.target.value,
                                          }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            )}
                          </Field>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      className={`${secondary} mt-4`}
                      onClick={() =>
                        update(
                          kind,
                          facts[kind]!.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove entry
                    </button>
                  </div>
                  </EditableSection>
                </div>
              ))}
              {!facts[kind]?.length && <Notice>No entries added yet.</Notice>}
              <button
                type="button"
                className={`${secondary} mt-3`}
                onClick={() => update(kind, [...(facts[kind] || []), {}])}
              >
                Add {sections[kind].toLowerCase()}
              </button>
            </fieldset>
          </section>
        ))}
        <section className="rounded-xl border border-board-line bg-board-panel p-5 sm:p-6">
          <EditableSection title="Skills & languages" preview={
            <ProfileValues values={["skills", "preferredSkills", "languages"].map(key => [labels[key], facts[key]])} />
          }>
          <Section title="Edit skills & languages">
            <div className="grid gap-4 sm:grid-cols-2">
              {["skills", "preferredSkills", "languages"].map((key) => (
                <Field key={key} label={`${labels[key]} (one per line)`}>
                  <textarea
                    name={key}
                    className={control}
                    rows={4}
                    value={
                      Array.isArray(facts[key])
                        ? (facts[key] as string[]).join("\n")
                        : (facts[key] as string) || ""
                    }
                    onChange={(e) => update(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </Section>
          </EditableSection>
        </section>
        <section className="rounded-xl border border-board-line bg-board-panel p-5 sm:p-6">
          <EditableSection title="Work authorization notes" preview={
            <ProfileValues values={[[labels.authorization, facts.authorization]]} />
          }>
          <p id="authorization-help" className="mt-2 text-sm text-board-muted">
            Optional background about your eligibility to work, reused across application profiles.
            Set country-specific authorization and sponsorship answers in Application identity &amp; eligibility below.
          </p>
          <div className="mt-5">
            <Field label={labels.authorization}>
              <textarea
                id="profile-authorization"
                name="authorization"
                aria-describedby="authorization-help"
                className={control}
                rows={3}
                value={(facts.authorization as string) || ""}
                onChange={(e) => update("authorization", e.target.value)}
              />
            </Field>
          </div>
          </EditableSection>
        </section>
        <div className="mt-7 space-y-3 border-t border-board-line py-5">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                review.current.check(
                  facts,
                  e.target.checked,
                  e.nativeEvent.isTrusted,
                );
                setChecked(e.target.checked && e.nativeEvent.isTrusted);
              }}
              className="h-5 w-5 accent-board-accent"
            />
            I have checked these facts.
          </label>
          <p className="text-sm text-board-muted">Review imported facts before checking them. Changes remain unverified until you review and save.</p>
          <button className={primary}>Save shared background</button>
          <Notice>{feedback}</Notice>
        </div>
      </form>
    </>
  );
}
