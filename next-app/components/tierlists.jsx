"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, control, primary, secondary, Field, Notice } from "./ui";
export default function TierLists() {
  const w = useWorkspace(),
    lists = w.state.workflow.tierLists,
    model = w.models.tierlistModel;
  const list =
    lists.find((l) => l.id === w.state.workflow.activeTierListId) || lists[0];
  const [selected, setSelected] = useState(""),
    [feedback, setFeedback] = useState("");
  function save(next) {
    w.store.set(
      "workflow.tierLists",
      lists.map((l) => (l.id === next.id ? next : l)),
    );
  }
  function move(company, tier, before) {
    try {
      save(model.move(list, company, tier, before));
      setSelected("");
      setFeedback("Company moved.");
    } catch (e) {
      setFeedback(e.message);
    }
  }
  function addList(e) {
    e.preventDefault();
    const name = e.currentTarget.elements.name.value.trim();
    if (!name) return;
    const next = model.create(name);
    w.store.set("workflow.tierLists", [...lists, next]);
    w.store.set("workflow.activeTierListId", next.id);
    e.currentTarget.reset();
  }
  if (!list) return <Notice>Company lists are loading.</Notice>;
  return (
    <Section title="Company tier lists">
      <p className="mb-4 text-sm text-board-muted">
        {list.description || list.rankingBasis}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Active company list">
          <select
            className={control}
            value={list.id}
            onChange={(e) => {
              w.store.set("workflow.activeTierListId", e.target.value);
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
          }}
        >
          Duplicate list
        </button>
      </div>
      <div className="mt-5 space-y-3">
        {[...list.tiers, { id: "unranked", label: "Unranked" }].map((t) => (
          <div
            key={t.id}
            className="grid gap-3 rounded-xl border border-board-line p-3 sm:grid-cols-[100px_1fr]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) move(id, t.id);
            }}
          >
            <div>
              {t.id === "unranked" ? (
                <strong className="text-sm">Unranked</strong>
              ) : (
                <input
                  className={`${control} text-sm`}
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
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(list.placements[t.id] || []).map((id) => {
                const c = list.companies.find((c) => c.id === id);
                return (
                  c && (
                    <button
                      key={id}
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
                      className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${selected === id ? "border-board-accent bg-board-tag" : "border-board-line bg-board-panel"}`}
                      onClick={() => setSelected(id)}
                    >
                      {c.name}
                    </button>
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
          {[...list.tiers, { id: "unranked", label: "Unranked" }].map((t) => (
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
            save(model.addCompany(list, e.currentTarget.elements.name.value));
            e.currentTarget.reset();
          } catch (e) {
            setFeedback(e.message);
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
      <Notice>{feedback}</Notice>
    </Section>
  );
}
