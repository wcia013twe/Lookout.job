// Browser sync controller: account-scoped local edits are persisted by one serial worker.
// generation invalidates requests after sign-out/account switching; loaded is the last
// server baseline. cloudDirty remains true until that exact local snapshot is synced.
import { createBackend } from "./backend/client.mjs";
import { fromCloud, draftPayload, batchRoles, uuid } from "./cloud-model.mjs";
function connectCloud(client) {
  const store = JB.store, button = document.querySelector("#account-save"), reload = document.querySelector("#account-load"), feedback = document.querySelector("#cloud-status");
  let loaded = null, account = null, generation = 0, applying = false, loading = false, running = null, timer = null, loadFailed = false;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const snapshot = (w) => JSON.stringify({ ...w, cloudDirty: false });
  function announceReady() {
    document.dispatchEvent(new CustomEvent("workspace:cloud-ready", {detail:{userId:account}}));
  }
  function controls(locked) {
    ["profile", "auto-tracker", "needs-you"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.inert = locked;
    });
    reload.disabled = locked;
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
    if (account && loaded && !loading && !loadFailed) timer = setTimeout(() => save().catch(() => {
    }), 650);
  }
  async function load(userId, replace = false) {
    const token = ++generation;
    account = userId;
    loaded = null;
    loadFailed = false;
    clearTimeout(timer);
    JB.setBatch?.(null);
    button.hidden = true;
    reload.hidden = !userId;
    feedback.textContent = "";
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
      const api = createBackend(client, userId), rows = await api.loadWorkspace();
      if (token !== generation) return;
      loaded = rows;
      if (!store.get("workflow.cloudDirty") || replace) apply(fromCloud(rows), true);
      // A missing/deleted morning batch must not disable otherwise healthy account sync.
      try {
        const id = new URL(location.href).searchParams.get("batch");
        if (id && !uuid(id)) throw Error("Invalid batch link");
        const prepared = id ? await api.getBatch(id) : await api.latestBatch();
        if (prepared) {
          const { batch, items } = prepared;
          await JB.catalogReady;
          if (token !== generation) return;
          JB.setBatch?.({ roles: batchRoles(items, batch.batch_date), date: batch.batch_date, label: batch.label });
        }
        if (token === generation) feedback.textContent = "Account connected. Changes sync automatically.";
      } catch {
        if (token !== generation) return;
        JB.setBatch?.(null);
        feedback.textContent = "Account connected. That job batch is unavailable; showing public jobs.";
      }
    } catch (error) {
      if (token === generation) {
        loadFailed = true;
        JB.setBatch?.(null);
        feedback.textContent = "Account or batch could not load. Browser changes are retained.";
        button.hidden = false;
      }
    } finally {
      if (token === generation) {
        loading = false;
        controls(false);
        announceReady();
        if (store.get("workflow.cloudDirty")) schedule();
      }
    }
  }
  async function persist() {
    const userId = account, token = generation, w = store.get("workflow"), api = createBackend(client, userId), touched = new Map(), remote = loaded;
    if (!userId || !remote || loading || loadFailed) throw Error("Account is not ready.");
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
    button.hidden = true;
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
      if (!same(w.searchPreferences || {}, baseline.searchPreferences) || !same(w.tierLists, baseline.tierLists) || w.activeTierListId !== baseline.activeTierListId) {
        await api.savePreferences({ search: {...remote.preferences[0]?.search || {}, ...w.searchPreferences || {}}, theme: remote.preferences[0]?.theme || { pack: "base" }, tierLists: w.tierLists, activeTierListId: w.activeTierListId });
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
        feedback.textContent = "Sync paused. Changes are kept in this browser. Retry, or load the account version if an application changed elsewhere.";
        button.hidden = false;
      }
      throw error;
    }
  }
  // A single worker owns writes; callers share its result instead of starting parallel saves.
  function save() {
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
    const token = generation, userId = account;
    controls(true);
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
      if (token === generation) controls(false);
    }
  }
  button.addEventListener("click", () => {
    if (!loaded || loadFailed) load(JB.auth.userId);
    else save().catch(() => {
    });
  });
  reload.addEventListener("click", () => {
    if (store.get("workflow.cloudDirty") && !confirm("Replace unsynced browser edits with the account version?")) return;
    load(account, true);
  });
  window.addEventListener("online", () => {
    if (account && (!loaded || loadFailed)) load(account);
    else schedule();
  });
  store.subscribe("workflow", () => {
    if (account && account === JB.auth.userId && !applying) {
      store.set("workflow.cloudDirty", true);
      feedback.textContent = "Changes saved locally \xB7 syncing\u2026";
      schedule();
    }
  });
  JB.cloud = { save, approve: (jobId) => transition(jobId, "Approved"), setStage: transition, resolveAttempt: (jobId,claimId,note) => transition(jobId,"Verified not submitted",{claimId,note}), get ready() {
    return Boolean(account && loaded && !loading && !loadFailed);
  } };
  document.addEventListener("workspace:account", (event) => {
    ++generation;
    account = null;
    loaded = null;
    clearTimeout(timer);
    setTimeout(() => load(event.detail.userId), 0);
  });
  if (JB.auth.userId) setTimeout(() => load(JB.auth.userId), 0);
}
export {
  connectCloud
};
