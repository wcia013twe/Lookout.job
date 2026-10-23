// Browser sync controller: account-scoped local edits are persisted by one serial worker.
// generation invalidates requests after sign-out/account switching; loaded is the last
// server baseline. cloudDirty remains true until that exact local snapshot is synced.
import { createBackend } from "../backend/client.mjs";
import { fromCloud, draftPayload, batchRoles, uuid } from "./cloud-model.mjs";
function connectCloud(client, ui = null) {
  const store = JB.store, feedback = ui?.feedback || document.querySelector("#cloud-status") || { textContent: "" };
  let suspendedForDemo = false;
  let loaded = null, account = null, generation = 0, applying = false, loading = false, transitioning = false, running = null, timer = null, loadFailed = false, backgroundTimer = null, refreshing = false, retryDelay = 5000;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const snapshot = (w) => JSON.stringify({ ...w, cloudDirty: false });
  function problem(message = "") { if (ui?.error) ui.error.textContent = message; }
  function queueBackground(delay = 15000) {
    clearTimeout(backgroundTimer);
    if (account && !suspendedForDemo) backgroundTimer = setTimeout(() => autoSync(), delay);
  }
  async function autoSync() {
    const token = generation;
    if (suspendedForDemo || !account || account !== JB.auth.userId) return;
    if (loading || transitioning || running || refreshing) { queueBackground(); return; }
    try {
      if(await reconcileReset(account)) { await load(account); return; }
      if (!loaded || loadFailed) { await load(account); return; }
      if (store.get("workflow.cloudDirty")) await save();
      else {
        refreshing = true;
        const before = snapshot(store.get("workflow"));
        const rows = await createBackend(client, account).loadWorkspace();
        if (token !== generation || loading || transitioning || running || store.get("workflow.cloudDirty") || snapshot(store.get("workflow")) !== before) return;
        loaded = rows;
        apply(fromCloud(rows), true);
        announceReady();
        await refreshBatch(account, token);
      }
      if (token === generation) { retryDelay = 5000; problem(); }
    } catch {
      if (token === generation) {
        problem("Connection interrupted. Your edits are kept here; syncing will retry automatically.");
        retryDelay = Math.min(retryDelay * 2, 60000);
      }
    } finally {
      refreshing = false;
      if (token === generation) queueBackground(retryDelay === 5000 ? 15000 : retryDelay);
    }
  }
  async function reconcileReset(userId) {
    const reset=await createBackend(client,userId).readResetState();
    if(userId!==account || userId!==JB.auth.userId)throw Error('Account changed');
    if(reset?.state==='pending')throw Error('Workspace reset is incomplete. Open Reset workspace to finish.');
    if(reset?.state==='completed' && store.get('resetEpoch')!==reset.id) {
      applying=true;
      try { store.clearAccountCache(userId,reset.id); } finally { applying=false; }
      return true;
    }
    return false;
  }
  function announceReady() {
    document.dispatchEvent(new CustomEvent("workspace:cloud-ready", {detail:{userId:account}}));
  }
  function controls(locked) {
    if (ui) { ui.locked(locked); return; }
    ["profile", "auto-tracker", "needs-you"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.inert = locked;
    });
    const approveButton = document.querySelector("#approve-draft");
    if (approveButton) approveButton.disabled = locked;
  }
  function apply(w, refresh = false) {
    applying = true;
    store.set("workflow", w);
    if (refresh) document.dispatchEvent(new CustomEvent("workspace:hydrated"));
    applying = false;
  }
  function schedule() {
    clearTimeout(timer);
    if (!suspendedForDemo && account && loaded && !loading && !loadFailed) timer = setTimeout(() => save().catch(() => {
    }), 650);
  }
  async function refreshBatch(userId, token) {
    const id = new URL(location.href).searchParams.get("batch");
    if (id && !uuid(id)) throw Error("Invalid batch link");
    const api = createBackend(client, userId);
    const prepared = id ? await api.getBatch(id) : await api.latestBatch();
    await JB.catalogReady;
    if(token !== generation || userId !== account || userId !== JB.auth.userId)return;
    JB.setBatch?.(prepared ? {roles:batchRoles(prepared.items,prepared.batch.batch_date),date:prepared.batch.batch_date,label:prepared.batch.label} : null);
  }
  async function load(userId) {
    if (suspendedForDemo) return;
    const token = ++generation;
    account = userId;
    transitioning = false;
    loaded = null;
    loadFailed = false;
    clearTimeout(timer);
    JB.setBatch?.(null);
    feedback.textContent = "";
    problem();
    if (!userId) {
      loading = false;
      controls(false);
      JB.setBatch?.(null);
      return;
    }
    loading = true;
    controls(true);
    feedback.textContent = "Loading your account\u2026";
    try {
      await reconcileReset(userId);
      const api = createBackend(client, userId), rows = await api.loadWorkspace();
      if (token !== generation) return;
      loaded = rows;
      if (!store.get("workflow.cloudDirty")) apply(fromCloud(rows), true);
      // A missing/deleted morning batch must not disable otherwise healthy account sync.
      try {
        await refreshBatch(userId, token);
        if (token === generation) { feedback.textContent = "Account connected. Changes sync automatically."; problem(); retryDelay = 5000; }
      } catch {
        if (token !== generation) return;
        JB.setBatch?.(null);
        feedback.textContent = "Account connected. That job batch is unavailable; your saved workspace is still available.";
      }
    } catch (error) {
      if (token === generation) {
        loadFailed = true;
        JB.setBatch?.(null);
        feedback.textContent = "Account could not load. Retrying automatically; browser changes are retained.";
        problem(feedback.textContent);
      }
    } finally {
      if (token === generation) {
        loading = false;
        controls(false);
        announceReady();
        if (store.get("workflow.cloudDirty")) schedule();
        queueBackground(loadFailed ? retryDelay : 15000);
      }
    }
  }
  async function persist() {
    const userId = account, token = generation, w = store.get("workflow"), api = createBackend(client, userId), touched = new Map(), remote = loaded;
    if (suspendedForDemo || !userId || !remote || loading || loadFailed) throw Error("Account is not ready.");
    if(await reconcileReset(userId)) { await load(userId); return; }
    if(token!==generation || suspendedForDemo)throw Error("Account changed.");
    let upgraded = false;
    for (const r of w.resumes) if (!uuid(r.id)) {
      const old = r.id;
      r.id = crypto.randomUUID();
      upgraded = true;
      Object.values(w.applications).forEach((a) => {
        if (a.resumeId === old) a.resumeId = r.id;
      });
    }
    if (upgraded) {
      applying = true;
      store.set("workflow", w);
      applying = false;
    }
    const sent = snapshot(w), baseline = fromCloud(remote);
    feedback.textContent = "Syncing\u2026";
    // Every SDK operation checks the expected owner; explicit inserts also use that owner for RLS.
    const assertAccount = () => {
      if (token !== generation || userId !== JB.auth.userId) throw Error("Account changed.");
    };
    function preserveEdits() {
      if (token !== generation) return;
      const latest = store.get("workflow");
      for (const [jobId, row] of touched) {
        if (latest.applications[jobId]) {
          latest.applications[jobId].backendId = row.id;
          latest.applications[jobId].backendRevision = row.revision;
        }
      }
      applying = true;
      store.set("workflow", latest);
      applying = false;
    }
    try {
      if (!same(w.profile, baseline.profile)) {
        const facts = { ...w.profile };
        delete facts.verified;
        await api.saveProfile(facts, w.profile.verified);
        assertAccount();
      }
      if (!same(w.searchPreferences || {}, baseline.searchPreferences) || !same(w.theme || { pack: "base" }, baseline.theme || { pack: "base" }) || !same(w.tierLists, baseline.tierLists) || w.activeTierListId !== baseline.activeTierListId) {
        await api.savePreferences({ search: {...remote.preferences[0]?.search || {}, ...w.searchPreferences || {}}, theme: w.theme || { pack: "base" }, tierLists: w.tierLists, activeTierListId: w.activeTierListId });
        assertAccount();
      }
      for (const r of w.resumes) if (!remote.resumes.some((x) => x.id === r.id)) {
        const row = await api.createResume({ id: r.id, name: r.name, variant: r.variant || "Master", reference_url: r.url || null, object_path: r.objectPath || null, content_hash:r.contentHash || null, version: r.version || 1 });
        assertAccount();
        remote.resumes.push(row);
      }
      for (const a of w.savedAnswers) if (!same(a, baseline.savedAnswers.find((x) => x.id === a.id))) {
        await api.saveAnswer({ ...a, verified: Boolean(a.verifiedAt), context: { version: a.version } });
        assertAccount();
      }
      for (const id of w.deletedAnswerIds || []) {
        await api.deleteAnswer(id);
        assertAccount();
      }
      for (const app of Object.values(w.applications)) {
        const previous = remote.applications.find((a) => a.job_id === app.id), draft = draftPayload(app);
        if (previous) {
          // Tracking records retain their submitted snapshot, even if employer facts change.
          if (["Submitted","Interview","Rejected","Offer","Withdrawn"].includes(previous.status)) continue;
          if (!same(previous.draft, draft) || (previous.blocker || "") !== (app.blocker || "")) {
            if (app.backendRevision !== previous.revision) throw Error("Application changed. Reload and review.");
            const row = await api.saveDraft(previous.id, previous.revision, draft, app.blocker || null);
            assertAccount();
            touched.set(app.id, row);
            Object.assign(previous, row);
          }
        } else {
          const row = await api.createDraft(app.id, draft, app.blocker || null);
          assertAccount();
          remote.applications.push(row);
          touched.set(app.id, row);
        }
      }
      const rows = await api.loadWorkspace();
      assertAccount();
      loaded = rows;
      if (snapshot(store.get("workflow")) === sent) {
        apply(fromCloud(rows));
        feedback.textContent = "Synced";
        problem(); retryDelay = 5000;
        announceReady();
      } else {
        preserveEdits();
        const latest = store.get("workflow");
        latest.deletedAnswerIds = (latest.deletedAnswerIds || []).filter((id) => !(w.deletedAnswerIds || []).includes(id));
        applying = true;
        store.set("workflow", latest);
        applying = false;
        feedback.textContent = "Syncing latest changes\u2026";
        schedule();
      }
    } catch (error) {
      preserveEdits();
      if (token === generation) {
        feedback.textContent = "Your edits are kept in this browser. Sync will retry automatically.";
        problem(feedback.textContent);
        queueBackground(retryDelay);
      }
      throw error;
    }
  }
  // A single worker owns writes; callers share its result instead of starting parallel saves.
  function save() {
    if (suspendedForDemo) return Promise.reject(Error("Account sync is paused for demo mode."));
    clearTimeout(timer);
    if (running) return running;
    if (!store.get("workflow.cloudDirty")) return Promise.resolve();
    const token = generation;
    const operation = (async () => {
      do {
        await persist();
      } while (token === generation && store.get("workflow.cloudDirty"));
    })();
    running = operation.finally(() => {
      if (running === tracked) running = null;
      if (token !== generation && store.get("workflow.cloudDirty")) schedule();
    });
    const tracked = running;
    return running;
  }
  async function transition(jobId, status, note = "") {
    if (suspendedForDemo) throw Error("Account actions are paused for demo mode.");
    const token = generation, userId = account;
    controls(true);
    transitioning = true;
    try {
      // Canonical role facts may have been filled in when hydrating a sparse agent draft.
      // Persist them before approval so the reviewed URL is in the exact approved revision.
      const pending=loaded?.applications.find(application=>application.job_id===jobId);
      const local=store.get("workflow.applications")[jobId];
      if(status==="Approved" && pending && local && !same(pending.draft,draftPayload(local))) {
        applying=true;store.set("workflow.cloudDirty",true);applying=false;
      }
      await save();
      if (token !== generation || userId !== JB.auth.userId) throw Error("Account changed.");
      const app = loaded?.applications.find((a) => a.job_id === jobId);
      if (!app) throw Error("Application has not synced.");
      const sent = snapshot(store.get("workflow")), api = createBackend(client, userId);
      if (status === "Approved") await api.approve(app.id, app.revision);
      else if (status === "Verified not submitted") await api.resolveAttempt(app.id, app.revision, note.claimId, note.note);
      else await api.setStage(app.id, app.revision, status, note);
      const rows = await api.loadWorkspace();
      if (token !== generation || userId !== JB.auth.userId) throw Error("Account changed.");
      loaded = rows;
      if (snapshot(store.get("workflow")) === sent) apply(fromCloud(rows));
      else {
        const latest = store.get("workflow"), row = rows.applications.find((a) => a.job_id === jobId);
        if (latest.applications[jobId] && row) latest.applications[jobId].backendRevision = row.revision;
        apply(latest);
        schedule();
      }
      feedback.textContent = status === "Approved" ? "Approved version synced. It has not been submitted." : "Application status synced.";
      announceReady();
    } finally {
      if (token === generation) { transitioning = false; controls(false); }
    }
  }
  window.addEventListener("online", () => autoSync());
  window.addEventListener("focus", () => autoSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") autoSync();
  });
  store.subscribe("workflow", () => {
    if (!suspendedForDemo && account && account === JB.auth.userId && !applying) {
      store.set("workflow.cloudDirty", true);
      feedback.textContent = "Changes saved locally \xB7 syncing\u2026";
      schedule();
    }
  });
  function suspendForDemo(active) {
    if (suspendedForDemo === active) return;
    suspendedForDemo = active;
    ++generation;
    clearTimeout(timer);
    clearTimeout(backgroundTimer);
    loading = false;
    transitioning = false;
    refreshing = false;
    controls(false);
    if (!active) return load(JB.auth.userId);
  }
  JB.cloud = { suspendForDemo, async pauseForReset() {
    suspendForDemo(true);
    await running?.catch(()=>{});
  }, save, approve: (jobId) => transition(jobId, "Approved"), setStage: transition, resolveAttempt: (jobId,claimId,note) => transition(jobId,"Verified not submitted",{claimId,note}), get ready() {
    return Boolean(!suspendedForDemo && account && loaded && !loading && !loadFailed);
  } };
  document.addEventListener("workspace:account", (event) => {
    ++generation;
    account = null;
    loaded = null;
    clearTimeout(timer);
    clearTimeout(backgroundTimer);
    setTimeout(() => load(event.detail.userId), 0);
  });
  if (JB.auth.userId) setTimeout(() => load(JB.auth.userId), 0);
  return JB.cloud;
}
export {
  connectCloud
};
