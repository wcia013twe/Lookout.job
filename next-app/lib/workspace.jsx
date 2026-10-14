"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { connectCloud } from "../../cloud.mjs";
import presets from "../../data/tierlist-presets.json";
import catalog from "../../data/jobs.json";
const Context = createContext(null);
let boot;
const URL = "https://umhqfqzpwmszhcknwtrs.supabase.co";
const KEY = "sb_publishable_hWhdwxwVfWS_0zd5VvoFzA_DvfV6jp5";
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export function asset(path) {
  return `${basePath}/${path}`;
}
async function initialize() {
  window.JB ||= {};
  await import("../../store.js");
  await Promise.all([
    import("../../workflow-model.js"),
    import("../../saved-answers-model.js"),
    import("../../tierlist-model.js"),
  ]);
  window.JB.tierlistModel.configure(presets);
  const store = window.JB.store;
  const existing = store.get("workflow.tierLists") || [];
  const additions = presets.presets
    .filter((p) => !existing.some((l) => l.presetKey === p.key))
    .map((p) => window.JB.tierlistModel.seed(p));
  if (additions.length)
    store.set("workflow.tierLists", [...existing, ...additions]);
  if (!store.get("workflow.activeTierListId"))
    store.set(
      "workflow.activeTierListId",
      store.get("workflow.tierLists")[0]?.id || "",
    );
  return store;
}
export function WorkspaceProvider({ children }) {
  const [state, setState] = useState(null),
    [user, setUser] = useState(null),
    [status, setStatus] = useState(""),
    [locked, setLocked] = useState(false),
    [batch, setBatch] = useState(null),
    [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const userRef = useRef(null),
    clientRef = useRef(null),
    actions = useRef({});
  useEffect(() => {
    let alive = true;
    const unsub = [];
    (boot ||= initialize())
      .then((store) => {
        if (!alive) return;
        setState(store.get());
        for (const slice of [
          "workflow",
          "network",
          "tracker",
          "progress",
          "drops",
        ])
          unsub.push(
            store.subscribe(slice, () => {
              if (alive) setState(store.get());
            }),
          );
        const client = (clientRef.current ||= createClient(URL, KEY, {
          auth: {
            flowType: "pkce",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }));
        window.JB.auth = {
          client,
          get userId() {
            return userRef.current;
          },
        };
        window.JB.catalogReady = Promise.resolve();
        window.JB.setBatch = (value) => {
          if (alive) setBatch(value);
        };
        function bridge(name) {
          return {
            addEventListener(type, handler) {
              actions.current[name] = handler;
            },
          };
        }
        const ui = {
          retry: bridge("retry"),
          reload: bridge("reload"),
          feedback: {
            set textContent(value) {
              if (alive) setStatus(value);
            },
          },
          locked(value) {
            if (alive) setLocked(value);
          },
        };
        window.JB.cloud = connectCloud(client, ui);
        function session(value) {
          if (!alive) return;
          const id = value?.user?.id || null;
          userRef.current = id;
          store.switchAccount(id);
          setUser(value?.user || null);
          setAuthReady(true);
          setState(store.get());
        }
        function seed() {
          const lists = store.get("workflow.tierLists") || [];
          const more = presets.presets
            .filter((p) => !lists.some((l) => l.presetKey === p.key))
            .map((p) => window.JB.tierlistModel.seed(p));
          if (more.length) {
            store.set("workflow.tierLists", [...lists, ...more]);
            const owner = userRef.current;
            queueMicrotask(() => {
              if (owner && userRef.current === owner)
                store.set("workflow.cloudDirty", true);
            });
          }
          if (!store.get("workflow.activeTierListId"))
            store.set(
              "workflow.activeTierListId",
              store.get("workflow.tierLists")[0]?.id || "",
            );
        }
        document.addEventListener("workspace:hydrated", seed);
        unsub.push(() =>
          document.removeEventListener("workspace:hydrated", seed),
        );
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, value) => session(value));
        unsub.push(() => subscription.unsubscribe());
        client.auth.getSession().then(({ data, error }) => {
          if (error) {
            setError(
              "Sign-in is unavailable. Your browser workspace remains available.",
            );
            setAuthReady(true);
          } else session(data.session);
        });
        navigator.serviceWorker?.register(asset("sw.js")).catch(() => {});
      })
      .catch(() => {
        if (alive) setError("Workspace could not load. Reload to retry.");
      });
    return () => {
      alive = false;
      unsub.forEach((fn) => fn());
    };
  }, []);
  const store = typeof window !== "undefined" ? window.JB?.store : null;
  async function signIn() {
    setError("");
    const redirect = new globalThis.URL(asset(""), location.origin);
    const id = new globalThis.URL(location.href).searchParams.get("batch");
    if (id) redirect.searchParams.set("batch", id);
    const { error } = await clientRef.current.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect.href },
    });
    if (error) setError("Could not start Google sign-in. Try again.");
  }
  async function signOut() {
    const { error } = await clientRef.current.auth.signOut({ scope: "local" });
    if (error) setError("Could not sign out. Try again.");
  }
  const value = {
    state,
    store,
    user,
    locked,
    status,
    error,
    authReady,
    signIn,
    signOut,
    retry: () => actions.current.retry?.(),
    reload: () => actions.current.reload?.(),
    roles: batch?.roles || catalog.roles,
    date: batch?.date || catalog.lastRun,
    batchLabel: batch?.label,
    models: typeof window !== "undefined" ? window.JB : null,
    client: clientRef.current,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  return useContext(Context);
}
export function useSlice(path) {
  const { state, store } = useWorkspace();
  return [
    path.split(".").reduce((v, k) => v?.[k], state),
    (value) => store?.set(path, value),
  ];
}
