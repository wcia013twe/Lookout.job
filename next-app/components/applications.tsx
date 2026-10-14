"use client";
import { useState } from "react";
import { dayStamp, awardStatus } from "../lib/progress.mjs";
import { useWorkspace } from "../lib/workspace";
import { Heading, control, Empty, Section, Notice } from "./ui";
import ApplicationList from "./application-list";
import SkippedOpportunities from "./skipped-opportunities";
import { sortApplications } from "../../application-timeline.mjs";
import type { Application } from "./workflow-types";
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
    ...Object.values(w.state.workflow.applications as Record<string, Application>)
      .filter((a) => !w.roles.some((r: Application) => r.id === a.id))
      .map((a) => ({ ...a, applicationUrl: a.url })),
  ];
  const matches = (r: Pick<Application, "employmentType" | "company" | "title">) =>
    (!type || r.employmentType === type) &&
    `${r.company} ${r.title}`.toLowerCase().includes(search.toLowerCase());
  const tracked: Application[] = sortApplications(catalog.filter(
    (r) => w.state.tracker.ids.includes(r.id) && matches(r),
  ).map((r: Application) => ({...r, status: w.state.workflow.applications[r.id]?.status || w.state.tracker.items[r.id]?.status || r.status, milestones: w.state.workflow.applications[r.id]?.milestones || []})));
  const apps = Object.values(w.state.workflow.applications as Record<string, Application>).filter(
    (a) => matches(a) && (!stage || a.status === stage),
  );
  function update(id: string, status: string) {
    awardStatus(w.store, id, status);
    w.store.update("tracker.items", (items: Record<string, { status?: string; statusDate?: string; openedDate?: string; appliedDate?: string }>) => ({
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
        Callbacks and upcoming interviews appear first. See the resume used and the stages recorded for each application.
      </Heading>
      <div className="glass-toolbar grid gap-3 rounded-xl p-3 sm:grid-cols-[1fr_160px]">
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
            <span className="glass-inset rounded-md px-2 py-1 tabular-nums" key={key}>
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
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_90px_120px_160px] gap-3 border-b border-board-line bg-board-tag/35 p-4 text-xs font-semibold text-board-muted xl:grid">
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
                  className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-board-line p-4 transition-colors last:border-b-0 hover:bg-board-accent/3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_90px_120px_160px] xl:items-center"
                >
                  <strong className="col-span-2 break-words text-sm xl:col-span-1">{r.company}</strong>
                  <a
                    href={r.applicationUrl}
                    onClick={(e) => { if (w.demo) e.preventDefault(); }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 min-w-0 break-words text-sm font-medium text-board-accent underline-offset-4 hover:underline xl:col-span-1"
                  >
                    {r.title}
                  </a>
                  <span className="text-sm text-board-muted">
                    <span className="mb-1 block text-xs xl:hidden">Type</span>
                    {r.employmentType === "FT" ? "Full-time" : "Internship"}
                  </span>
                  <span className="text-sm tabular-nums text-board-muted">
                    <span className="mb-1 block text-xs xl:hidden">Opened / applied</span>
                    {item.appliedDate || item.openedDate || "Not listed"}
                  </span>
                  <select
                    className={`${control} col-span-2 mt-1 xl:col-span-1 xl:mt-0`}
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
      <Section title="Application progress">
        <p className="mb-4 text-sm text-board-muted">
          Active callbacks come first. Email updates can add stages when Muse has authorized inbox access.
        </p>
        <select
          className={`${control} mb-4 sm:max-w-xs`}
          aria-label="Application stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {w.models.workflowModel.stages.map((s: string) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {!!apps.length && <ApplicationList items={apps} />}
        {!apps.length && (
          <Notice>No drafts here. Queue a role from Discover.</Notice>
        )}
      </Section>
      <SkippedOpportunities />
    </>
  );
}
