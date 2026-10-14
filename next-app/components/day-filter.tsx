"use client";
type DayFilterProps = { label: string; dates: string[]; latest: string; value: string; onChange: (value: string) => void };
import { control } from "./ui";

export default function DayFilter({ label, dates, latest, value, onChange }: DayFilterProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-board-muted">
      {label}
      <select className={control} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="latest">Latest · {latest}</option>
        {dates.filter((date) => date !== latest).map((date) => (
          <option key={date} value={date}>{date}</option>
        ))}
        <option value="all">All history</option>
      </select>
    </label>
  );
}
