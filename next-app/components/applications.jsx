"use client";
import { useState } from "react";
import { dayStamp, awardStatus } from "../lib/progress.mjs";
import { useWorkspace } from "../lib/workspace";
import { Heading, control, Empty, Section, Notice } from "./ui";
import ApplicationList from "./application-list";
const statuses = [
  "New",
  "Applied",
  "OA",
  "Phone Screen",
  "Interview",
  "Onsite",
  "Offer",
  "Rejected",
  "Withdrawn",
];
export default function Applications() {
  const w = useWorkspace();
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [stage, setStage] = useState("");
  const catalog = [
    ...w.roles,
    ...Object.values(w.state.workflow.applications)
      .filter((a) => !w.roles.some((r) => r.id === a.id))
      .map((a) => ({ ...a, applicationUrl: a.url })),
  ];
  const matches = (r) =>
    (!type || r.employmentType === type) &&
    `${r.company} ${r.title}`.toLowerCase().includes(search.toLowerCase());
  const tracked = catalog.filter(
    (r) => w.state.tracker.ids.includes(r.id) && matches(r),
  );
  const apps = Object.values(w.state.workflow.applications).filter(
    (a) => matches(a) && (!stage || a.status === stage),
  );
  function update(id, status) {
    awardStatus(w.store, id, status);
    w.store.update("tracker.items", (items) => ({
      ...items,
      [id]: {
        ...items[id],
        status,
        statusDate: dayStamp(),
        ...(status !== "New" && !items[id]?.appliedDate
          ? { appliedDate: dayStamp() }
          : {}),
      },
    }));
  }
  return (
    <>
      <Heading title="Applications">
        Track the roles you’ve opened and update your progress after applying.
      </Heading>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <input
          aria-label="Search tracked roles"
          className={control}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles or companies"
        />
        <select
          aria-label="Role type"
          className={control}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="FT">Full-time</option>
          <option>Internship</option>
        </select>
      </div>
      <div className="mt-7 flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-bold">Your tracked roles</h2>
        <div className="flex gap-2 text-xs">
          {[
            ["FT", "full-time"],
            ["Internship", "internships"],
          ].map(([key, label]) => (
            <span className="rounded-md bg-board-tag px-2 py-1" key={key}>
              {tracked.filter((r) => r.employmentType === key).length} {label}
            </span>
          ))}
        </div>
      </div>
      <Notice>
        Opening a role is separate from applying. Update its status after you
        apply.
      </Notice>
      <div className="mt-4">
        {!tracked.length ? (
          <Empty
            title={
              w.state.tracker.ids.length
                ? "No matching roles"
                : "Your next opportunity starts here"
            }
            href="/"
            action="Browse roles"
          >
            Open a role from Discover to track it.
          </Empty>
        ) : (
          <div className="space-y-3 md:overflow-hidden md:rounded-2xl md:border md:border-board-line md:bg-board-panel md:space-y-0">
            <div className="hidden grid-cols-[1fr_2fr_100px_120px_150px] gap-3 bg-board-tag p-4 text-xs text-board-muted md:grid">
              <span>Company</span>
              <span>Job title</span>
              <span>Type</span>
              <span>Opened / applied</span>
              <span>Status</span>
            </div>
            {tracked.map((r) => {
              const item = w.state.tracker.items[r.id] || {};
              return (
                <div
                  key={r.id}
                  className="grid gap-3 rounded-2xl border border-board-line bg-board-panel p-4 md:grid-cols-[1fr_2fr_100px_120px_150px] md:items-center md:rounded-none md:border-0 md:border-t"
                >
                  <strong>{r.company}</strong>
                  <a
                    href={r.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-board-accent hover:underline"
                  >
                    {r.title}
                  </a>
                  <span className="text-sm text-board-muted">
                    {r.employmentType === "FT" ? "Full-time" : "Internship"}
                  </span>
                  <span className="text-sm text-board-muted">
                    {item.appliedDate || item.openedDate || "Not listed"}
                  </span>
                  <select
                    className={control}
                    aria-label={`Status for ${r.title}`}
                    value={item.status || "New"}
                    onChange={(e) => update(r.id, e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s === "New" ? "Opened" : s}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Section title="Agent workspace">
        <p className="mb-4 text-sm text-board-muted">
          Prepared drafts and review actions. A draft is not a submitted
          application.
        </p>
        <select
          className={`${control} mb-4 sm:max-w-xs`}
          aria-label="Application stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {w.models.workflowModel.stages.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <ApplicationList items={apps} />
        {!apps.length && (
          <Notice>No drafts here. Queue a role from Discover.</Notice>
        )}
      </Section>
    </>
  );
}
