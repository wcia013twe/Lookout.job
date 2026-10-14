"use client";
import { useState } from "react";
import { useSlice } from "../lib/workspace";
import templates from "../../outreach-templates.js";
const inputClass =
  "min-h-11 min-w-0 rounded-lg border border-board-line bg-board-tag px-3 py-2 text-base";
const buttonClass =
  "min-h-11 rounded-lg bg-board-accent px-4 py-2 font-bold text-board-ink hover:bg-board-accent-hover";
export default function Referrals() {
  const [targets, setTargets] = useSlice("network.referrals");
  const [people, setPeople] = useSlice("network.people");
  const [template, setTemplate] = useState(0);
  const [feedback, setFeedback] = useState("");
  function add(e, kind) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (
      !data.name?.trim() ||
      !data.company?.trim() ||
      (kind === "referral" && !data.role?.trim())
    )
      return;
    const row = { ...data, id: crypto.randomUUID() };
    if (kind === "referral")
      setTargets([
        ...targets,
        { ...row, contact: row.name, title: row.role, status: "Not asked" },
      ]);
    else setPeople([...people, { ...row, followUp: row.followup }]);
    e.currentTarget.reset();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(templates[template].body);
      setFeedback("Message copied. Replace the brackets before sending.");
    } catch {
      setFeedback("Copy failed. Select the message and copy it manually.");
    }
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Referrals &amp; networking</h1>
      <p className="mt-3 text-board-muted">
        Keep your contacts, follow-ups, and outreach in one place.
      </p>
      <p className="mt-4 text-sm text-board-muted">
        Referrals and contacts are saved in this browser.
      </p>
      <section className="mt-8">
        <h2 className="text-lg font-bold">Referral targets</h2>
        <form
          onSubmit={(e) => add(e, "referral")}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input
            className={inputClass}
            name="company"
            aria-label="Referral company"
            placeholder="Company"
            required
          />
          <input
            className={inputClass}
            name="role"
            aria-label="Referral role"
            placeholder="Role title"
            required
          />
          <input
            className={inputClass}
            name="name"
            aria-label="Referral contact"
            placeholder="Contact name"
            required
          />
          <select className={inputClass} name="path" aria-label="Referral path">
            {[
              "Engineer I know",
              "Engineer (cold)",
              "Recruiter",
              "Alum",
              "Former coworker",
              "Friend",
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <input
            className={inputClass}
            name="link"
            type="url"
            aria-label="Referral job link"
            placeholder="Job link (optional)"
          />
          <button className={buttonClass}>Add referral target</button>
        </form>
        <ul className="mt-4 divide-y divide-board-line">
          {targets.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <strong>
                  {t.company} · {t.title || t.role}
                </strong>
                <p className="text-sm text-board-muted">
                  {t.contact || t.name} · {t.path}
                </p>
              </div>
              <select
                className={inputClass}
                aria-label={`Referral status for ${t.company}`}
                value={t.status}
                onChange={(e) =>
                  setTargets(
                    targets.map((r) =>
                      r.id === t.id ? { ...r, status: e.target.value } : r,
                    ),
                  )
                }
              >
                {[
                  "Not asked",
                  "Asked",
                  "Referred",
                  "Applied",
                  "Interviewing",
                  "Offer",
                  "Rejected",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                className="min-h-11 px-3 text-sm text-board-muted hover:text-board-accent"
                onClick={() => setTargets(targets.filter((r) => r.id !== t.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {!targets.length && (
          <p className="mt-4 text-sm text-board-muted">
            Add your first referral target above.
          </p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-bold">Your network</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => add(e, "person")}
        >
          <input
            className={inputClass}
            name="name"
            aria-label="Contact name"
            placeholder="Name"
            required
          />
          <input
            className={inputClass}
            name="company"
            aria-label="Contact company"
            placeholder="Company"
            required
          />
          <select className={inputClass} name="warmth" aria-label="Warmth">
            {["Warm", "Cooling", "Cold"].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
          <input
            className={inputClass}
            name="followup"
            aria-label="Next follow-up"
            type="date"
          />
          <input
            name="notes"
            className={inputClass}
            aria-label="Contact notes"
            placeholder="Notes (optional)"
          />
          <button className={buttonClass}>Add contact</button>
        </form>
        <ul className="mt-4 divide-y divide-board-line">
          {people.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <strong>
                  {p.name} · {p.company}
                </strong>
                <p className="text-sm text-board-muted">
                  {p.warmth} · {p.followUp || p.followup || "No follow-up set"}{" "}
                  {p.notes ? `· ${p.notes}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 px-3 text-sm text-board-muted hover:text-board-accent"
                onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {!people.length && (
          <p className="mt-4 text-sm text-board-muted">
            Add people you want to stay in touch with.
          </p>
        )}
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-bold">Message templates</h2>
        <label className="mt-4 block text-sm text-board-muted">
          Message type
          <select
            className={`${inputClass} mt-2 block w-full sm:max-w-sm`}
            value={template}
            onChange={(e) => {
              setTemplate(Number(e.target.value));
              setFeedback("");
            }}
          >
            {templates.map((t, i) => (
              <option value={i} key={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <h3 className="mt-5 font-bold">{templates[template].name}</h3>
        <p className="mt-2 text-sm text-board-muted">
          {templates[template].use}
        </p>
        <p className="mt-4 rounded-2xl border border-board-line bg-board-panel p-5 text-sm leading-relaxed">
          {templates[template].body}
        </p>
        <button type="button" onClick={copy} className={`${buttonClass} mt-4`}>
          Copy message
        </button>
        <p className="mt-3 text-sm text-board-muted" role="status">
          {feedback}
        </p>
      </section>
    </>
  );
}
