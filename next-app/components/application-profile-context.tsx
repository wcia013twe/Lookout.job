"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  parseRecruitingTargets,
  recruitingTargetsHeading,
  recruitingTargetsKey,
} from "../../lib/recruiting-targets.mjs";
import { useWorkspace } from "../lib/workspace";
import {
  initialPrompt,
  normalizeSearchProfile,
  profileFromPrompt,
  promptFromProfile,
  readField,
  updateField,
} from "../../lib/search-profile.mjs";
export type ApplicationProfile = {
  id: string;
  name: string;
  active: boolean;
  version?: number;
  prompt: string;
  filters?: Record<string, unknown>;
  priorities?: Record<string, unknown>;
  instructions?: string;
};
function useProfiles() {
  const w = useWorkspace();
  const p = w.state.workflow.searchPreferences || {};
  const [drafts, setDrafts] = useState<Record<string, ApplicationProfile>>({});
  const [selected, setSelected] = useState("general"),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const saved: ApplicationProfile[] = (
    p.profiles?.length
      ? p.profiles.map(normalizeSearchProfile)
      : [{ ...profileFromPrompt(initialPrompt(p)), version: 0 }]
  ).map((v: ApplicationProfile) => ({ ...v, prompt: promptFromProfile(v) }));
  const profiles = [
    ...saved.map((v) => drafts[v.id] || v),
    ...Object.values(drafts).filter((v) => !saved.some((s) => s.id === v.id)),
  ];
  const profile = profiles.find((v) => v.id === selected) || profiles[0];
  function patch(fields: Partial<ApplicationProfile>) {
    setDrafts((prev) => ({ ...prev, [profile.id]: { ...profile, ...fields } }));
    setFeedback("Unsaved changes to this application profile.");
  }
  function field(heading: string, key: string) {
    return readField(profile.prompt, heading, key);
  }
  function change(heading: string, key: string, value: string) {
    try {
      patch({ prompt: updateField(profile.prompt, heading, key, value) });
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Could not update field.");
    }
  }
  function create(name: string, duplicate = false) {
    if (!name.trim() || busy) return;
    const id = crypto.randomUUID();
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        id,
        name: name.trim().slice(0, 80),
        active: duplicate ? profile.active : true,
        version: 0,
        prompt: duplicate ? profile.prompt : initialPrompt(),
      },
    }));
    setSelected(id);
    setFeedback("New application profile. Save when ready.");
  }
  async function saveProfile() {
    if (busy || w.locked) return false;
    const owner = w.demo ? null : w.user?.id;
    const id = profile.id;
    setBusy(true);
    try {
      const targets = readField(
        profile.prompt,
        recruitingTargetsHeading,
        recruitingTargetsKey,
      );
      if (targets.conflict)
        throw Error(
          "Resolve duplicate Targets fields in Advanced instructions.",
        );
      parseRecruitingTargets(targets.value, { requireNames: true });
      if (readField(profile.prompt, "Profile evaluation", "Rules").conflict)
        throw Error(
          "Resolve duplicate profile evaluation Rules in Advanced instructions.",
        );
      const next = profileFromPrompt(profile.prompt, profile);
      let stored;
      if (owner) {
        const { data, error } = await w.client.rpc("save_search_profile", {
          expected_version: profile.version || 0,
          next_profile: next,
        });
        if (error)
          throw Error(
            error.code === "40001"
              ? "This profile changed elsewhere. Reload before retrying; your draft is kept."
              : "Could not save. Your draft is kept; retry when connected.",
          );
        if (window.JB.auth.userId !== owner) return false;
        stored = data;
      } else stored = { ...next, version: (profile.version || 0) + 1 };
      w.store.update(
        "workflow.searchPreferences",
        (current: Record<string, any>) => ({
          ...current,
          profiles: (current.profiles || []).some(
            (v: ApplicationProfile) => v.id === id,
          )
            ? current.profiles.map((v: ApplicationProfile) =>
                v.id === id ? stored : v,
              )
            : [...(current.profiles || []), stored],
        }),
      );
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setFeedback(
        owner
          ? "Application profile saved."
          : w.demo
            ? "Demo application profile saved in memory."
            : "Saved in this browser. Sign in to sync with your agent.",
      );
      return true;
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    if (busy) return;
    setBusy(true);
    try {
      if (!w.demo && w.user) {
        const owner = w.user.id;
        const { data, error } = await w.client
          .from("preferences")
          .select("search")
          .eq("user_id", owner)
          .maybeSingle();
        if (error) throw Error("Could not reload. Your draft is kept.");
        if (window.JB.auth.userId !== owner) return;
        w.store.update(
          "workflow.searchPreferences",
          (v: Record<string, unknown>) => ({
            ...v,
            profiles: data?.search?.profiles || [],
          }),
        );
      }
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[profile.id];
        return copy;
      });
      setFeedback("Loaded saved application profile.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Could not reload.");
    } finally {
      setBusy(false);
    }
  }
  return {
    profiles,
    profile,
    select: (id: string) => {
      setSelected(id);
      setFeedback("");
    },
    patch,
    field,
    change,
    create,
    saveProfile,
    reload,
    busy,
    feedback,
    setFeedback,
    dirty: !!drafts[profile.id],
  };
}
const Context = createContext<ReturnType<typeof useProfiles> | null>(null);
export function ApplicationProfileProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useProfiles();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApplicationProfile() {
  const value = useContext(Context);
  if (!value) throw Error("Application profile provider required");
  return value;
}
