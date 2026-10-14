"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Heading, control, Notice, primary } from "./ui";
import RoleCard from "./role-card";
import DailyDrops from "./daily-drops";
import DayFilter from "./day-filter";
export default function Discover() {
  const w = useWorkspace();
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [day, setDay] = useState("latest");
  const dates = [...new Set([w.date, ...w.roles.map((r) => r.discoveredDate)].filter(Boolean))].sort().reverse();
  const selectedDay = day === "latest" ? w.date : day;
  const roles = w.roles.filter(
    (r) =>
      (selectedDay === "all" || r.discoveredDate === selectedDay) &&
      (day !== "latest" || !w.state.tracker.ids.includes(r.id)) &&
      (!type || r.employmentType === type) &&
      `${r.company} ${r.title} ${r.location} ${r.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading title="Discover">
        {w.batchLabel || "Your latest roles, ready to explore."}
      </Heading>
      <div className="mb-6 grid items-end gap-3 sm:grid-cols-[1fr_180px_160px]">
        <input
          aria-label="Search roles or companies"
          placeholder="Search roles or companies"
          className={control}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <DayFilter label="Discover day" dates={dates} latest={w.date} value={day} onChange={setDay} />
        <select
          aria-label="Employment type"
          className={control}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="FT">Full-time</option>
          <option>Internship</option>
        </select>
      </div>
      <Notice>
        {roles.length} to review ·{" "}
        {roles.filter((r) => r.priority === "Apply Now").length} apply now
      </Notice>
      <DailyDrops />
      {[
        ["FT", "Full-time"],
        ["Internship", "Internships"],
      ].map(([key, label]) => (
        <section key={key} className="mt-7">
          <h2 className="mb-4 text-lg font-bold">{label}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles
              .filter((r) => r.employmentType === key)
              .map((r) => (
                <RoleCard key={r.id} role={r} />
              ))}
          </div>
          {!roles.some((r) => r.employmentType === key) && (
            <Notice>No new {label.toLowerCase()} roles for this view.</Notice>
          )}
        </section>
      ))}
      <details className="mt-8 text-sm text-board-muted">
        <summary className="min-h-11">How tracking works</summary>
        <p>
          Opening a posting adds it to Applications. Update the status after
          applying. Queuing creates a draft for your agent; it does not submit
          an application.
        </p>
      </details>
    </>
  );
}
