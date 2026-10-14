"use client";
import { useEffect, useState } from "react";
import { asset, useWorkspace } from "../lib/workspace";
import { claimPack, dayStamp } from "../lib/progress.mjs";
import { rarityOf, RARITY_LABEL, TIER_HEX } from "../lib/role-display";
import { secondary, primary, Notice } from "./ui";
export default function DailyDrops() {
  const [drops, setDrops] = useState([]),
    [opened, setOpened] = useState(false),
    [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(0),
    [feedback, setFeedback] = useState("");
  const w = useWorkspace();
  useEffect(() => {
    fetch(asset("data/sudo-drops.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setDrops(v?.drops || []))
      .catch(() => {});
  }, []);
  if (!drops.length) return null;
  const latest = [...drops].sort((a, b) =>
    String(b.dateSeen).localeCompare(String(a.dateSeen)),
  );
  const today = dayStamp();
  const pack = latest.filter(
    (d) =>
      d.dateSeen === today && rarityOf(d.company, d.type, d.title) !== "common",
  );
  const current = pack[index];
  function open() {
    setOpened(true);
    setIndex(0);
    setRevealed(1);
    setFeedback("");
  }
  function close() {
    setOpened(false);
    w.store.set(`drops.packStamps.${today}`, true);
  }
  function next() {
    const n = Math.min(index + 1, pack.length - 1);
    setIndex(n);
    setRevealed(Math.max(revealed, n + 1));
  }
  function claim() {
    const added = claimPack(w.store);
    setFeedback(
      added
        ? "+25 XP claimed"
        : "Pack complete. Today’s XP was already claimed.",
    );
    w.store.update("drops.seenDropIds", (v) => [
      ...new Set([
        ...(v || []),
        ...pack.map((d) => `${d.dateSeen}|${d.company}|${d.title}`),
      ]),
    ]);
  }
  return (
    <section className="mt-6 rounded-2xl border border-board-line bg-board-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Daily drops</h2>
          <p className="mt-1 text-xs text-board-muted">
            {latest.length} opportunities across{" "}
            {new Set(latest.map((d) => d.dateSeen)).size} days
          </p>
        </div>
        {pack.length > 0 && (
          <button className={secondary} onClick={open}>
            Open pack
          </button>
        )}
      </div>
      {opened && current && (
        <div
          key={index}
          className="pack-reveal mt-4 border-t border-board-line pt-4"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-board-muted">
              {index + 1} of {pack.length}
            </span>
            <span
              style={{
                color:
                  TIER_HEX[
                    rarityOf(current.company, current.type, current.title)
                  ],
              }}
            >
              {
                RARITY_LABEL[
                  rarityOf(current.company, current.type, current.title)
                ]
              }
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold">
            {current.company} · {current.title}
          </h3>
          <p className="mt-2 text-sm text-board-muted">
            {current.location} · {current.status}
          </p>
          <p className="mt-3 text-sm text-board-muted">
            {current.note || current.skipReason}
          </p>
          {current.url && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${primary} mt-3`}
            >
              Open application
            </a>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={secondary}
              disabled={index === pack.length - 1}
              onClick={next}
            >
              Next drop
            </button>
            <button
              className={secondary}
              onClick={() => {
                setIndex(pack.length - 1);
                setRevealed(pack.length);
              }}
            >
              Reveal all
            </button>
            {revealed === pack.length && (
              <button className={primary} onClick={claim}>
                Claim pack XP
              </button>
            )}
            <button className={secondary} onClick={close}>
              Close pack
            </button>
          </div>
          <Notice>{feedback}</Notice>
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="min-h-11 py-3 text-board-accent">
          View all drops
        </summary>
        {latest.map((d, i) => (
          <article key={i} className="border-t border-board-line py-3">
            <strong>
              {d.company} · {d.title}
            </strong>
            <p className="mt-1 text-xs text-board-muted">
              {d.dateSeen} · {d.type} · {d.status}
            </p>
            <p className="mt-2 text-board-muted">{d.note || d.skipReason}</p>
            {d.url && (
              <a
                className="mt-2 inline-flex min-h-11 items-center text-board-accent"
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open source
              </a>
            )}
          </article>
        ))}
      </details>
    </section>
  );
}
