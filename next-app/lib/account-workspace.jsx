"use client";
import {importLegacyCompanies} from "../../lib/network-model.mjs";
import { useEffect, useRef, useState } from "react";
import {Context,asset} from "./workspace-context.jsx";
import {navigateWorkspaceMode} from "./workspace-mode.mjs";
import { createClient } from "@supabase/supabase-js";
import { connectCloud } from "../../lib/cloud.mjs";
import presets from "../../data/tierlist-presets.json";
import {rememberOnboardingReturn,takeOnboardingReturn} from "./onboarding-auth.mjs";
import catalog from "../../data/jobs.json";
import {useWebsiteOnboarding} from "./use-website-onboarding";
import {canViewWorkspace} from "./workspace-access";
import {SUPABASE_URL as URL,SUPABASE_PUBLISHABLE_KEY as KEY} from "./supabase-config.mjs";
import {configuredLocalTestCredentials} from "./local-test-auth";
let boot;
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
  store.set("network",importLegacyCompanies(store.get()));
  return store;
}
export default function AccountWorkspaceProvider({ children }) {
  const [state, setState] = useState(null),
    [user, setUser] = useState(null),
    [status, setStatus] = useState(""),
    [locked, setLocked] = useState(false),
    [batch, setBatch] = useState(null),
    [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
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
          "ui.profileConflict",
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
        window.JB.lastCompanyOwner=null;
        function session(value) {
          if (!alive) return;
          const id = value?.user?.id || null;
          const accountChanged=userRef.current!==id;
          if(accountChanged) setBatch(null);
          userRef.current = id;
          const guestCompanies=id&&accountChanged&&window.JB.lastCompanyOwner===null?(store.get("network.companies")||[]):[];
          store.switchAccount(id);
          store.set("network",importLegacyCompanies(store.get()));
          if(id&&guestCompanies.length){const own=store.get("network.companies")||[];store.set("network.companies",[...own,...guestCompanies.filter(row=>!own.some(saved=>saved.id===row.id)).map(row=>({...row,revision:0,dirty:true,legacyImport:true}))]);}
          window.JB.lastCompanyOwner=id;
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
        client.auth.getSession().then(async ({ data, error }) => {
          if (!alive) return;
          const credentials = configuredLocalTestCredentials(location.origin, URL);
          if (!error && !data.session && credentials) {
            const result = await client.auth.signInWithPassword(credentials);
            if (!alive) return;
            if (result.error) {
              setError("Local test sign-in failed. Check the saved test account credentials.");
              setAuthReady(true);
            } else session(result.data.session);
            return;
          }
          if (error) {
            setError(
              "Sign-in is unavailable. Reload to try again.",
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
  useEffect(()=>{
    if(!authReady||!user)return;
    try {if(takeOnboardingReturn(window.sessionStorage,{signedIn:true,path:location.pathname}))location.replace(asset("onboarding/"));}catch{ /* Direct OAuth return still works if tab storage is blocked. */ }
  },[authReady,user?.id]);
  const store = typeof window !== "undefined" ? window.JB?.store : null;
  async function signIn() {
    setError("");
    const credentials = configuredLocalTestCredentials(location.origin, URL);
    if (credentials) {
      const {error} = await clientRef.current.auth.signInWithPassword(credentials);
      if (error) setError("Local test sign-in failed. Check the saved test account credentials.");
      return;
    }
    try {rememberOnboardingReturn(window.sessionStorage,location.pathname);}catch{ /* No private data is stored here. */ }
    const returnToOnboarding = /\/onboarding\/?$/.test(location.pathname);
    const redirect = new globalThis.URL(asset(returnToOnboarding ? "onboarding/" : ""), location.origin);
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
  const hasAccess = canViewWorkspace({authReady,user});
  const websiteOnboarding=useWebsiteOnboarding(clientRef.current,hasAccess?user:null);
  const value = {
    websiteOnboarding,
    state,store,user,accountUser:user,demo:false,demoEpoch:0,canDemo:true,
    toggleDemo:()=>navigateWorkspaceMode(window.location,true),resetDemo:()=>{},
    locked,status,error,authReady,signIn,signOut,syncError,
    hasPrivateBatch:hasAccess&&Boolean(batch),publicRoles:hasAccess?catalog.roles:[],publicDate:hasAccess?catalog.lastRun:"",
    roles:hasAccess?(batch?.roles || []):[],date:hasAccess?(batch?.date || ""):"",batchLabel:hasAccess?batch?.label:undefined,
    models:typeof window!=="undefined"?window.JB:null,
    client:clientRef.current,services:null,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
