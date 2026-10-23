"use client";
import { useState, type CSSProperties, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CompanyLogo } from "./role-card";
import { TIER_HEX } from "../lib/role-display";
import styles from "./tierlists.module.css";
const rarityByTier: Record<string, keyof typeof TIER_HEX> = {S:"mythic", A:"legendary", B:"epic", C:"rare", D:"common"};

type Company = { id: string; name: string };
type Tier = { id: string; label: string };
type TierList = { id: string; name: string; description?: string; rankingBasis?: string; tiers: Tier[]; companies: Company[]; placements: Record<string, string[]> };
import { useWorkspace } from "../lib/workspace";
import { Section, control, primary, secondary, Field, Notice } from "./ui";
export default function TierLists({ selectedListId, onSelectList }: { selectedListId?: string; onSelectList?: (id: string) => void } = {}) {
  const w = useWorkspace(),
    lists: TierList[] = w.state.workflow.tierLists,
    model = w.models.tierlistModel;
  const list =
    lists.find((l) => l.id === (selectedListId || w.state.workflow.activeTierListId)) || lists[0];
  const [selected, setSelected] = useState(""),
    [feedback, setFeedback] = useState("");
  const reduceMotion = useReducedMotion();
  const tiers: Tier[] = list ? [...list.tiers, { id: "unranked", label: "Unranked" }] : [];
  function save(next: TierList) {
    w.store.set(
      "workflow.tierLists",
      lists.map((l) => (l.id === next.id ? next : l)),
    );
  }
  function move(company: string, tier: string, before?: string) {
    try {
      save(model.move(list, company, tier, before));
      setSelected("");
      setFeedback("Company moved.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Could not update this list.");
    }
  }
  function addList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") || "").trim();
    if (!name) return;
    const next = model.create(name);
    w.store.set("workflow.tierLists", [...lists, next]);
    w.store.set("workflow.activeTierListId", next.id);
    onSelectList?.(next.id);
    e.currentTarget.reset();
  }
  if (!list) return <Section title="Company tier lists"><p className="mb-4 text-sm text-board-muted">Create a company list to associate with this search profile.</p><form onSubmit={addList} className="flex flex-wrap items-end gap-3"><Field label="New list name"><input name="name" className={control} required /></Field><button className={secondary}>Create list</button></form><Notice>{feedback}</Notice></Section>;
  return (
    <Section title="Company tier lists">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Active company list">
          <select
            className={control}
            value={list.id}
            onChange={(e) => {
              w.store.set("workflow.activeTierListId", e.target.value);
              onSelectList?.(e.target.value);
              setSelected("");
            }}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="List name">
          <input
            className={control}
            value={list.name}
            onChange={(e) => save({ ...list, name: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <form onSubmit={addList} className="flex min-w-0 flex-wrap gap-3">
          <input
            name="name"
            aria-label="New list name"
            className={`${control} sm:w-48`}
            placeholder="New list name"
            required
          />
          <button className={secondary}>Create list</button>
        </form>
        <button
          className={secondary}
          onClick={() => {
            const next = model.duplicate(list, `${list.name} copy`);
            w.store.set("workflow.tierLists", [...lists, next]);
            w.store.set("workflow.activeTierListId", next.id);
            onSelectList?.(next.id);
          }}
        >
          Duplicate list
        </button>
      </div>
      <p className="mt-5 text-xs text-board-muted">Drag companies between tiers, or select a company and choose its destination below.</p>
      <div className={styles.board} aria-label="Company ranking board">
        {tiers.map((t) => (
          <div
            key={t.id}
            className={styles.row}
            data-tier={t.id}
            style={{"--rank-color": rarityByTier[t.id] ? TIER_HEX[rarityByTier[t.id]] : "var(--color-board-muted)", "--rank-ink": t.id === "S" ? "#fff" : "#080808"} as CSSProperties}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) move(id, t.id);
            }}
          >
            <div className={`${styles.label} ${t.id === "unranked" ? styles.unranked : ""}`}>
              {t.id === "unranked" ? (
                <strong className={styles.unrankedText}>Unranked</strong>
              ) : (
                <>
                <input
                  className={styles.rankInput}
                  aria-label={`Rename ${t.id} tier`}
                  maxLength={24}
                  value={t.label}
                  onChange={(e) =>
                    save({
                      ...list,
                      tiers: list.tiers.map((v) =>
                        v.id === t.id
                          ? { ...v, label: e.target.value || v.id }
                          : v,
                      ),
                    })
                  }
                />
                {rarityByTier[t.id] && <span className={styles.rarity}>{rarityByTier[t.id]}</span>}
                </>
              )}
            </div>
            <div className={styles.companies}>
              {(list.placements[t.id] || []).map((id) => {
                const c = list.companies.find((c) => c.id === id);
                return (
                  c && (
                    <motion.div className={styles.tile} key={id} layout={!reduceMotion} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
                    <button
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", id);
                        setSelected(id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        move(e.dataTransfer.getData("text/plain"), t.id, id);
                      }}
                      aria-pressed={selected === id}
                      className={styles.company}
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => setSelected(id)}
                    >
                      <CompanyLogo company={c.name}/>
                      <span className={styles.companyName}>{c.name}</span>
                    </button>
                    </motion.div>
                  )
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="mt-4 flex flex-wrap gap-2">
          <p className="w-full text-sm text-board-muted">
            Move {list.companies.find((c) => c.id === selected)?.name} to:
          </p>
          {tiers.map((t) => (
            <button
              key={t.id}
              className={secondary}
              onClick={() => move(selected, t.id)}
            >
              {t.label}
            </button>
          ))}
          <button className={secondary} onClick={() => setSelected("")}>
            Cancel
          </button>
        </div>
      )}
      <form
        className="mt-5 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            save(model.addCompany(list, String(new FormData(e.currentTarget).get("name") || "")));
            e.currentTarget.reset();
          } catch (e) {
            setFeedback(e instanceof Error ? e.message : "Could not update this list.");
          }
        }}
      >
        <input
          className={`${control} sm:w-56`}
          name="name"
          aria-label="Custom company name"
          placeholder="Company name"
          required
        />
        <button className={secondary}>Add company</button>
      </form>
      {feedback && <Notice>{feedback}</Notice>}
    </Section>
  );
}
