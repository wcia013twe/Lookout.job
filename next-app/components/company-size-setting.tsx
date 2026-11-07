"use client";

import { companySizeOptions, readCompanySizes, writeCompanySizes } from "../../lib/company-size.mjs";

type Props = { value: string; disabled: boolean; conflict: boolean; onChange: (value: string) => void };
export default function CompanySizeSetting({ value, disabled, conflict, onChange }: Props) {
  const { selected, other } = readCompanySizes(value);
  const all = selected.length === companySizeOptions.length;
  return <fieldset disabled={disabled || conflict} className="min-w-0 space-y-3 disabled:opacity-60">
    <legend className="mb-3 text-sm font-medium">Company size</legend>
    <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="size-5" checked={all}
        ref={input => { if (input) input.indeterminate = selected.length > 0 && !all; }}
        onChange={() => onChange(writeCompanySizes(all ? [] : companySizeOptions, other))}/>
      {all ? "Unselect all sizes" : "Select all sizes"}
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      {companySizeOptions.map(option => <label key={option} className="relative flex cursor-pointer">
        <input type="checkbox" className="peer sr-only" checked={selected.includes(option)}
          onChange={event => onChange(writeCompanySizes(event.target.checked ? [...selected, option] : selected.filter((size: string) => size !== option), other))}/>
        <span className="flex min-h-16 w-full items-center rounded-2xl border border-board-line bg-board-panel px-4 py-3 text-sm font-semibold text-board-text peer-checked:border-board-accent peer-checked:bg-board-accent peer-checked:text-board-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-board-accent peer-disabled:cursor-not-allowed hover:border-board-accent">{option} employees</span>
      </label>)}
    </div>
    {other && <p className="text-sm text-board-muted">Additional saved preference: {other}. Edit in Advanced instructions.</p>}
    {conflict && <p className="text-sm text-board-muted">Resolve duplicate Company size lines in Advanced instructions.</p>}
    {!value && !conflict && <p className="text-sm text-board-muted">No company size preference.</p>}
  </fieldset>;
}
