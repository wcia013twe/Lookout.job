"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const inFlight = useRef(false);
  const attempted = useRef(new Map<string, string>());
  const latestDrafts = useRef<Record<string, ApplicationProfile>>({});
  const [saveError, setSaveError] = useState(false);
  const failedProfile = useRef<string | null>(null);
  const p = w.state.workflow.searchPreferences || {};
  const [drafts, setDrafts] = useState<Record<string, ApplicationProfile>>({});
  latestDrafts.current = drafts;
  const [selected, setSelected] = useState(() => w.store.get("ui.applicationProfileId") || "general"),
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
    setFeedback("Changes save automatically.");
    setSaveError(false);
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
    w.store.set("ui.applicationProfileId", id);
    setFeedback("New application profile saves automatically.");
  }
  async function saveProfileRecord(savingProfile: ApplicationProfile) {
    if (inFlight.current || w.locked) return false;
    inFlight.current = true;
    attempted.current.set(savingProfile.id, JSON.stringify(savingProfile));
    const draftAtStart = latestDrafts.current[savingProfile.id];
    setSaveError(false);
    const owner = w.demo ? null : w.user?.id;
    const id = savingProfile.id;
    setBusy(true);
    try {
      const targets = readField(
        savingProfile.prompt,
        recruitingTargetsHeading,
        recruitingTargetsKey,
      );
      if (targets.conflict)
        throw Error(
          "Resolve duplicate Targets fields in Advanced instructions.",
        );
      parseRecruitingTargets(targets.value, { requireNames: true });
      if (readField(savingProfile.prompt, "Profile evaluation", "Rules").conflict)
        throw Error(
          "Resolve duplicate profile evaluation Rules in Advanced instructions.",
        );
      const next = profileFromPrompt(savingProfile.prompt, savingProfile);
      let stored;
      if (owner) {
        const { data, error } = await w.client.rpc("save_search_profile", {
          expected_version: savingProfile.version || 0,
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
      } else stored = { ...next, version: (savingProfile.version || 0) + 1 };
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
        if (copy[id] === draftAtStart) delete copy[id];
        else if (copy[id]) copy[id] = { ...copy[id], version: stored.version };
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
      failedProfile.current = id;
      setSaveError(true);
      setFeedback(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  // Save every pending profile, including one the user has just switched away from.
  // Failed snapshots wait for an edit or explicit retry rather than looping requests.
  const pendingKey = JSON.stringify(drafts);
  useEffect(() => {
    if (busy || w.locked) return;
    const pending = Object.values(drafts).find(value =>
      value.name.trim() && attempted.current.get(value.id) !== JSON.stringify(value));
    if (!pending) return;
    const timer = setTimeout(() => { void saveProfileRecord(pending); }, 600);
    return () => clearTimeout(timer);
  }, [pendingKey, busy, w.locked]);
  function saveProfile(){return saveProfileRecord(profile);}
  function saveProfilePrompt(prompt:string){return saveProfileRecord({...profile,prompt});}
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
      w.store.set("ui.applicationProfileId", id);
      setFeedback("");
    },
    patch,
    field,
    change,
    create,
    saveProfile,
    retrySave: () => {
      const pending = drafts[failedProfile.current || profile.id];
      return pending ? saveProfileRecord(pending) : Promise.resolve(false);
    },
    saveProfilePrompt,
    reload,
    busy,
    feedback,
    saveError,
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
