"use client";
import {demoFixtures} from './network-demo.mjs';
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { canUseDemo, createMemoryStore, createDemoServices } from "./demo.mjs";
import { withApplicationProfileDemo } from "./application-profile-demo.mjs";
import { demoOutreachContacts } from './outreach-demo.mjs';
import { dayStamp } from "./progress.mjs";
import { connectCloud } from "../../lib/cloud.mjs";
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
  await import("../../lib/store.js");
  await Promise.all([
    import("../../lib/workflow-model.js"),
    import("../../lib/saved-answers-model.js"),
    import("../../lib/tierlist-model.js"),
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
  const [syncError, setSyncError] = useState("");
  const [demoState,setDemoState]=useState(null);
  const demoStore=useRef(null), demoServices=useRef(null);
  const [demoEpoch,setDemoEpoch]=useState(0);
  const [authReady, setAuthReady] = useState(false);
  const userRef = useRef(null),
    clientRef = useRef(null);
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
        const ui = {
          error: { set textContent(value) { if (alive) setSyncError(value); } },
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
          const accountChanged=userRef.current!==id;
          userRef.current = id;
          store.switchAccount(id);
          setUser(value?.user || null);
          setAuthReady(true);
          if(accountChanged){setDemoState(null);demoStore.current=null;}
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
          } else { session(data.session); if(data.session) client.auth.getUser().then(({data})=>{if(alive && data.user?.id===userRef.current)setUser(data.user);}); }
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
  const canDemo = !user || user.is_anonymous === true || canUseDemo(user);
  function toggleDemo() {
    if(demoState) {setDemoState(null);demoStore.current=null;demoServices.current=null;return;}
    if(!canDemo)return;
    const fixtures=withApplicationProfileDemo(demoFixtures(dayStamp()));
    fixtures.state.network.referrals=[...demoOutreachContacts(),...fixtures.state.network.referrals.filter(r=>r.collection==='companies'||r.collection==='network-demo')];
    fixtures.state.workflow.tierLists=presets.presets.map(p=>window.JB.tierlistModel.seed(p));
    fixtures.state.workflow.activeTierListId=fixtures.state.workflow.tierLists[0]?.id || "";
    demoStore.current=createMemoryStore(fixtures.state,setDemoState);demoServices.current=createDemoServices(demoStore.current);
    setDemoState(demoStore.current.get());setDemoEpoch(n=>n+1);
  }
  function resetDemo() {if(!canDemo)return;setDemoEpoch(n=>n+1);const fixtures=withApplicationProfileDemo(demoFixtures(dayStamp()));fixtures.state.network.referrals=[...demoOutreachContacts(),...fixtures.state.network.referrals.filter(r=>r.collection==='companies'||r.collection==='network-demo')];fixtures.state.workflow.tierLists=presets.presets.map(p=>window.JB.tierlistModel.seed(p));fixtures.state.workflow.activeTierListId=fixtures.state.workflow.tierLists[0]?.id || "";demoStore.current=createMemoryStore(fixtures.state,setDemoState);demoServices.current=createDemoServices(demoStore.current);setDemoState(demoStore.current.get());}
  const value = {
    state:demoState || state,
    store:demoState ? demoStore.current : store,
    user:demoState ? null : user,
    accountUser:user,
    demo:Boolean(demoState),demoEpoch,canDemo,toggleDemo,resetDemo,
    locked:demoState ? false : locked,
    status:demoState ? "Demo changes stay in memory." : status,
    error:demoState ? "" : error,
    authReady,
    signIn,
    signOut,
    syncError: demoState ? "" : syncError,
    roles:demoState ? demoState.demo.roles : batch?.roles || catalog.roles,
    date:demoState ? dayStamp() : batch?.date || catalog.lastRun,
    batchLabel:demoState ? "Demo listings — fictional data for preview." : batch?.label,
    models: typeof window !== "undefined" ? window.JB : null,
    client:demoState ? null : clientRef.current,
    services:demoState ? demoServices.current : null,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Legacy domain/store boundary; presentation components type the records they consume.
 * @returns {any}
 */
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
