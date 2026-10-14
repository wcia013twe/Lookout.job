"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import schema from "../../profile-schema.js";
import { useWorkspace } from "../lib/workspace";
import { Field, control, primary, secondary, Notice, Section } from "./ui";
const labels = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  phone: "Phone number",
  location: "City / location",
  linkedin: "LinkedIn URL",
  github: "GitHub URL",
  portfolio: "Portfolio URL",
  otherUrl: "Other URL",
  authorization: "Work authorization",
  headline: "Current title",
  currentEmployer: "Current employer",
  jobSearchStatus: "Job search status",
  skills: "Skills",
  preferredSkills: "Skills you prefer to use",
  languages: "Languages",
};
const sections = {
  workExperience: "Work experience",
  education: "Education",
  projects: "Projects & outside experience",
};
export default function ProfileEditor() {
  const w = useWorkspace();
  const profile = w.state.workflow.profile;
  const [facts, setFacts] = useState(profile),
    [checked, setChecked] = useState(false),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    setFacts(profile);
    setChecked(profile.verified === true);
  }, [JSON.stringify(profile), w.user?.id]);
  function update(key, value) {
    setFacts({ ...facts, [key]: value });
    setChecked(false);
  }
  function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = { ...facts };
    for (const key of schema.scalarFields) {
      const element = form.elements[key];
      if (element) {
        const value = element.value.trim();
        values[key] = value;
      }
    }
    const changed = schema.scalarFields.some((key) => {
      const current = Array.isArray(facts[key])
        ? facts[key].join("\n")
        : facts[key] || "";
      return values[key] !== String(current).trim();
    });
    w.store.set("workflow.profile", {
      ...values,
      verified: checked && !changed,
    });
    setFeedback(
      checked && !changed
        ? "Profile saved and checked by you."
        : "Profile saved as unverified. Review changed facts before checking them.",
    );
  }
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-board-muted">
          {profile.verified ? "Facts checked by you" : "Profile is unverified"}
        </p>
        <Link href="/onboarding/" className={primary}>
          Start setup
        </Link>
      </div>
      <p className="mb-6 text-sm leading-relaxed text-board-muted">
        Ask Muse to read your resume or Simplify profile PDF. Extracted facts
        stay unverified and missing facts stay blank until you review them.
      </p>
      <form autoComplete="on" onSubmit={save}>
        <fieldset>
          <legend className="text-lg font-bold">
            Personal information &amp; links
          </legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {schema.scalarFields
              .filter(
                (k) => !["skills", "preferredSkills", "languages"].includes(k),
              )
              .map((key) => (
                <Field label={labels[key]} key={key}>
                  <input
                    id={`profile-${key}`}
                    name={key}
                    className={control}
                    value={facts[key] || ""}
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
                      {
                        name: "name",
                        firstName: "given-name",
                        lastName: "family-name",
                        email: "email",
                        phone: "tel",
                        location: "address-level2",
                      }[key] || "off"
                    }
                    onChange={(e) => update(key, e.target.value)}
                  />
                </Field>
              ))}
          </div>
        </fieldset>
        {Object.entries(schema.schemas).map(([kind, fields]) => (
          <fieldset className="mt-8 border-t border-board-line pt-5" key={kind}>
            <legend className="pr-3 text-lg font-bold">{sections[kind]}</legend>
            {(facts[kind] || []).map((entry, index) => (
              <div className="mb-5 border-b border-board-line py-4" key={index}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(
                    ([key, label, type = "text", autocomplete = "off"]) => (
                      <Field label={label} key={key}>
                        {type === "textarea" ? (
                          <textarea
                            className={control}
                            value={entry[key] || ""}
                            onChange={(e) =>
                              update(
                                kind,
                                facts[kind].map((v, i) =>
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
                              type === "checkbox" ? undefined : entry[key] || ""
                            }
                            onChange={(e) =>
                              update(
                                kind,
                                facts[kind].map((v, i) =>
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
                      facts[kind].filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove entry
                </button>
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
        ))}
        <Section title="Skills & languages">
          <div className="grid gap-4 sm:grid-cols-2">
            {["skills", "preferredSkills", "languages"].map((key) => (
              <Field key={key} label={`${labels[key]} (one per line)`}>
                <textarea
                  name={key}
                  className={control}
                  rows={4}
                  value={
                    Array.isArray(facts[key])
                      ? facts[key].join("\n")
                      : facts[key] || ""
                  }
                  onChange={(e) => update(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </Section>
        <div className="mt-7 space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-5 w-5 accent-board-accent"
            />
            I have checked these facts.
          </label>
          <button className={primary}>Save profile</button>
          <Notice>{feedback}</Notice>
        </div>
      </form>
    </>
  );
}
