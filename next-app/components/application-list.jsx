"use client";
import { useState } from "react";
import { primary, secondary, Empty } from "./ui";
import DraftReview from "./draft-review";
export default function ApplicationList({ items }) {
  const [review, setReview] = useState(null);
  return (
    <>
      <ul className="divide-y divide-board-line">
        {items.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-4 py-4"
          >
            <div className="min-w-0">
              <strong>{d.company}</strong>
              <p className="mt-1 text-sm text-board-muted">{d.title}</p>
              <p className="mt-2 text-xs text-board-accent">
                {d.status}
                {d.status === "Approved"
                  ? " · waiting for runner"
                  : d.receipt
                    ? " · employer confirmation observed"
                    : d.status === "Submitted"
                      ? " · reported by you"
                      : ""}
              </p>
            </div>
            <button className={secondary} onClick={() => setReview(d.id)}>
              {[
                "Submitted",
                "Interview",
                "Offer",
                "Rejected",
                "Withdrawn",
              ].includes(d.status)
                ? "View progress"
                : "Review"}
            </button>
          </li>
        ))}
      </ul>
      {review && (
        <DraftReview key={review} id={review} onClose={() => setReview(null)} />
      )}
    </>
  );
}
