"use client";

import { useId, useState } from "react";
import { industryOptions, parseIndustries, toggleIndustry } from "../../lib/industries.mjs";
import { profileSectionStyles } from "./profile-section";

type IndustryPickerProps = {
  value: string;
  disabled?: boolean;
  conflict?: boolean;
  onChange: (value: string) => void;
};

export default function IndustryPicker({ value, disabled = false, conflict = false, onChange }: IndustryPickerProps) {
  const id = useId();
  const selected = parseIndustries(value);
  // Keep an unchecked legacy choice available until the editor closes, so a
  // second click can restore it without a separate draft or persistence format.
  const [initialCustom] = useState(() => parseIndustries(value).filter(item => !industryOptions.includes(item)));
  const custom = [...new Set([...initialCustom, ...selected.filter(item => !industryOptions.includes(item))])];
  function bubble(industry: string) {
    const pressed = selected.includes(industry);
    return <button
      key={industry}
      type="button"
      aria-pressed={pressed}
      disabled={disabled || conflict}
      onClick={() => onChange(toggleIndustry(value, industry))}
      className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${pressed ? "border-board-accent bg-board-accent text-board-ink enabled:hover:bg-board-accent-hover" : "border-board-line bg-board-tag text-board-text enabled:hover:border-board-accent"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <path d={pressed ? "m5 12 4 4L19 6" : "M12 5v14M5 12h14"} />
      </svg>
      <span className="min-w-0 [overflow-wrap:anywhere]">{industry}</span>
    </button>;
  }
  return <fieldset disabled={disabled || conflict} aria-describedby={`${id}-help`} className="min-w-0">
    <legend className="mb-2 text-sm text-board-muted">Industries</legend>
    <p id={`${id}-help`} className="mb-3 text-sm text-board-muted">
      {conflict ? "Resolve duplicate Industries lines in Advanced instructions." : "Choose all that fit. Leave all unselected for no industry preference."}
    </p>
    <div className="flex flex-wrap gap-2">{industryOptions.map(bubble)}</div>
    {custom.length > 0 && <div className="mt-4">
      <p className="mb-2 text-sm text-board-muted">Additional saved industries</p>
      <div className="flex flex-wrap gap-2">{custom.map(bubble)}</div>
    </div>}
  </fieldset>;
}

export function IndustrySummary({ value, priority }: { value: string; priority: string }) {
  const industries = parseIndustries(value);
  return <>
    {industries.length ? <ul aria-label="Selected industries" className={profileSectionStyles.tags}>{industries.map(industry => <li key={industry}>{industry}</li>)}</ul> : "Not specified"}
    {priority && <p className="mt-2 text-sm text-board-muted">{priority}</p>}
  </>;
}
