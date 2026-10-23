import {validateCardPacks,batchPackDrops} from '../lib/card-packs.mjs';
import {validatePlatformPayload} from '../supabase/functions/agent-gateway/platform-tools.mjs';
import {callApi} from '../lib/api-failure.mjs';
import {validateFieldUpdate,readUserBrief} from '../lib/agent-workflows.mjs';
import {validateArtifact,uuid} from '../lib/artifacts.mjs';
// Data access for an authenticated browser client. Never use a service-role client.
// expectedUserId catches account changes before requests; database RLS is authoritative.
/** @param {any} client @param {string|null} [expectedUserId] */
function createBackend(client, expectedUserId = null) {
  async function result(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }
  async function owner() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Sign in required");
    if (expectedUserId && data.user.id !== expectedUserId)
      throw new Error("Account changed");
    return data.user.id;
  }
  // Stable ordering prevents pagination from silently losing application history.
  async function allRows(table, userId, order = "id", fields = "*") {
    const rows = [],
      pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const page = await result(
        client
          .from(table)
          .select(fields)
          .eq("user_id", userId)
          .order(order)
          .range(offset, offset + pageSize - 1),
      );
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
  async function owned(table, fields, conflict) {
    const userId = await owner();
    return result(
      client
        .from(table)
        .upsert({ ...fields, user_id: userId }, { onConflict: conflict })
        .select()
        .single(),
    );
  }
  async function resetRequest(body) {
    const id=await owner();
    const data=await result(client.functions.invoke('workspace-reset',{body}));
    if(await owner()!==id)throw Error('Account changed');
    if(!data?.data)throw Error('Reset returned no receipt');
    return data.data;
  }
  return {
    async readResetState() {
      const id=await owner();
      const {data,error}=await client.rpc('workspace_reset_state');
      if(await owner()!==id)throw Error('Account changed');
      // Older deployments cannot reset workspaces yet; keep their normal sync.
      if(error && ['PGRST202','42883'].includes(error.code))return {};
      if(error)throw error;
      return data;
    },
    previewWorkspaceReset() { return resetRequest({action:'preview'}); },
    resetWorkspace(payload) { return resetRequest({action:'reset',...payload}); },
    async onboardingAction(operation, payload = {}) {
      await owner();
      return result(client.rpc("onboarding_action", { operation, payload }));
    },
    async readUserBrief(options={}) {
      const userId=await owner();
      const response=await readUserBrief((_operation,payload)=>client.rpc('read_user_brief_snapshot',{payload,expected_owner:userId}),options);
      if(response.error)throw response.error;
      if(await owner()!==userId)throw Error('Account changed');
      return response.data;
    },
    async updateFields(operation, payload) {
      if(!validateFieldUpdate(operation,payload))throw Error('Unknown field update');
      const userId=await owner();
      const data=await result(client.rpc('update_workspace_fields',{operation,payload,expected_owner:userId}));
      if(await owner()!==userId)throw Error('Account changed');
      return data;
    },
    async readCardPackSettings() {
      const id=await owner();
      const data=await callApi('card_packs.settings.read',()=>client.from('preferences').select('theme,search,updated_at').eq('user_id',id).maybeSingle(),()=>true);
      if(await owner()!==id)throw Error('Account changed');
      validateCardPacks(data?.theme?.cardPacks||[]);
      return {theme:data?.theme||{},sources:data?.search?.targets||[],schedule:data?.search?.schedule||null,updatedAt:data?.updated_at||null};
    },
    async readCardPackFeed(packId,offset=0) {
      if(!uuid(packId)||!Number.isInteger(offset)||offset<0)throw Error('Pack ID and offset required');
      const id=await owner();
      const batches=await callApi('card_packs.batches.read',()=>client.from('job_batches').select('id,batch_date,created_at').eq('user_id',id).like('source_event_id',`card-pack:${packId}:%`).order('batch_date',{ascending:false}).order('created_at',{ascending:false}).order('id').range(offset,offset+9),Array.isArray);
      const items=batches.length?await callApi('card_packs.items.read',()=>client.from('batch_items').select('batch_id,position,recommendation,jobs(id,canonical_url,employer)').eq('user_id',id).in('batch_id',batches.map(b=>b.id)).order('position').limit(1000),Array.isArray):[];
      if(await owner()!==id)throw Error('Account changed');
      return {drops:batchPackDrops(batches,items),nextOffset:batches.length===10?offset+10:null};
    },
    async performPlatformAction(operation, payload) {
      validatePlatformPayload(operation,payload);
      const id=await owner();
      const data=await callApi(operation,()=>client.rpc(['preferences.theme.save','preferences.notifications.save'].includes(operation)?'configure_card_pack_preferences':'perform_platform_action',{operation,payload}));
      if(await owner()!==id)throw Error('Account changed');
      return data;
    },
    signIn(email, redirectTo) {
      return result(
        client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        }),
      );
    },
    signOut() {
      return result(client.auth.signOut());
    },
    async artifactAction(operation, payload = {}) {
      validateArtifact(operation,payload);
      await owner();
      const data = await callApi(operation,()=>client.rpc('artifact_action',{operation,payload}),data=>!!data&&typeof data==='object'&&(operation!=='artifacts.list'||Array.isArray(data.items)));
      await owner();
      return data;
    },
    async readToolkitResults({kind,applicationId}={}) {
      const userId=await owner();
      let query=client.from('career_toolkit_results').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(100);
      if(kind)query=query.eq('kind',kind);
      if(applicationId)query=query.eq('application_id',applicationId);
      return result(query);
    },
    async loadWorkspace() {
      const userId = await owner();
      const tables = [
        "profiles",
        "preferences",
        "resumes",
        "answer_library",
        "applications",
        "activity_events",
        "submission_attempts",
        "application_milestones",
      ];
      const rows = await Promise.all(
        tables.map((t) =>
          allRows(
            t,
            userId,
            ["profiles", "preferences"].includes(t) ? "user_id" : "id",
            t === "applications" ? "*,jobs(*)" : t === "submission_attempts" ? "id,user_id,application_id,state,started_at,created_at,finished_at,receipt,resume_snapshot:context_snapshot->resume" : "*",
          ),
        ),
      );
      return Object.fromEntries(tables.map((t, i) => [t, rows[i]]));
    },
    saveProfile(facts, verified = false) {
      return owned(
        "profiles",
        {
          facts,
          verified_at: verified ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        "user_id",
      );
    },
    async savePreferences({
      search = {}, tierLists = [], activeTierListId = null, theme = { pack: "base" },
    }) {
      await owner();
      return result(client.rpc("save_preferences_preserving_quiet", {
        search_next:search,lists_next:tierLists,active_next:activeTierListId,theme_next:theme,
      }));
    },
    saveAnswer({
      id,
      question,
      answer,
      policy = "ask",
      companyScope = "",
      verified = false,
      context = {},
    }) {
      if (policy === "auto" && !verified)
        throw new Error("Review the answer before allowing autofill");
      return owned(
        "answer_library",
        {
          ...(id ? { id } : {}),
          question,
          answer,
          autofill_policy: policy,
          company_scope: companyScope.trim() || null,
          context,
          provenance: "user",
          verified_at: verified ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        "id",
      );
    },
    async deleteAnswer(id) {
      const userId = await owner();
      return result(
        client
          .from("answer_library")
          .delete()
          .eq("id", id)
          .eq("user_id", userId),
      );
    },
    async createResume(resume) {
      const userId = await owner();
      // Uploads insert metadata before local autosync observes them. Adopt that exact
      // immutable version rather than overwriting it or failing on a duplicate ID.
      async function existing() {
        const row = await result(
          client
            .from("resumes")
            .select("*")
            .eq("id", resume.id)
            .eq("user_id", userId)
            .maybeSingle(),
        );
        if (!row) return null;
        const sameVersion =
          (row.object_path || null) === (resume.object_path || null) &&
          (row.reference_url || null) === (resume.reference_url || null) &&
          row.version === (resume.version || 1) &&
          (!resume.content_hash || row.content_hash === resume.content_hash);
        if (!sameVersion)
          throw new Error(
            "Resume ID refers to a different version. Reload the account workspace.",
          );
        return row;
      }
      const found = await existing();
      if (found) return found;
      try {
        return await result(
          client
            .from("resumes")
            .insert({ ...resume, user_id: userId })
            .select()
            .single(),
        );
      } catch (error) {
        if (error.code !== "23505") throw error;
        const inserted = await existing();
        if (!inserted) throw error;
        return inserted;
      }
    },
    async readSubmissionRecord(applicationId) {
      const userId = await owner();
      const application = await result(client.from("applications").select("id,status,receipt,submitted_at").eq("id", applicationId).eq("user_id", userId).single());
      const raw = await result(client.from("submission_attempts").select("id,application_id,state,revision,started_at,created_at,finished_at,receipt,context_snapshot").eq("application_id", applicationId).eq("user_id", userId).order("created_at"));
      // Only the submitted materials are returned to the view, not saved facts/settings.
      const attempts = raw.map(t => ({...t, context_snapshot: { application: {draft:t.context_snapshot?.application?.draft}, job:t.context_snapshot?.job, resume:t.context_snapshot?.resume }}));
      await owner();
      return {application, attempts};
    },
    async readApplicationTimeline(applicationId) {
      const userId = await owner();
      const application = await result(client.from("applications").select("*").eq("id",applicationId).eq("user_id",userId).single());
      const milestones = (await allRows("application_milestones",userId,"id")).filter(row=>row.application_id===applicationId);
      await owner();
      return {application,milestones};
    },
    async recordApplicationMilestone(applicationId, payload) {
      await owner();
      return result(client.rpc("record_application_milestone", {app_id:applicationId,payload}));
    },
    async readPreparationPlanner() {
      await owner();
      const data = await result(client.rpc("read_preparation_planner"));
      await owner();
      return data;
    },
    async savePreparationBudget(dailyMinutes, expectedVersion) {
      await owner();
      const data = await result(client.rpc("save_preparation_budget", {next_minutes:dailyMinutes,expected_version:expectedVersion}));
      await owner();
      return data;
    },
    async completePreparationSession({sessionId,minutes,targets}) {
      await owner();
      const data = await result(client.rpc("complete_preparation_session", {session_id:sessionId,session_minutes:minutes,session_targets:targets}));
      await owner();
      return data;
    },
    async readPreparation(applicationId) {
      const userId = await owner();
      const data = await result(client.from("preparation_plans").select("*").eq("application_id", applicationId).eq("user_id", userId).maybeSingle());
      await owner();
      return data;
    },
    async savePreparation(applicationId, expectedVersion, plan) {
      await owner();
      const data = await result(client.rpc("save_preparation_plan", {app_id:applicationId,expected_version:expectedVersion,next_plan:plan}));
      await owner();
      return data;
    },
    async readSelectionDecisions() {
      const userId = await owner();
      return allRows("selection_decisions", userId, "id", "*,jobs(*)");
    },
    async reconsiderSelection(id, expectedReconsideredAt = "") {
      await owner();
      return result(client.rpc("reconsider_selection", {decision_id:id,expected_at:expectedReconsideredAt}));
    },
    async readQuietMode() {
      await owner();
      return result(client.rpc("read_quiet_mode"));
    },
    async saveQuietMode(settings, expectedPersonalVersion) {
      await owner();
      return result(client.rpc("save_quiet_mode", {next_settings:settings,expected_version:expectedPersonalVersion}));
    },
    async resolveAttempt(applicationId, revision, claimId, note) {
      await owner();
      return result(client.rpc("resolve_submission_attempt", {app_id:applicationId,expected_revision:revision,claim_id:claimId,note}));
    },
    async createDraft(jobId, draft, blocker = null) {
      const userId = await owner();
      return result(
        client
          .from("applications")
          .insert({ user_id: userId, job_id: jobId, draft, blocker })
          .select()
          .single(),
      );
    },
    async uploadResume(file, { name, variant = "Master", version = 1 }) {
      const userId = await owner();
      const extension =
        file.type === "application/pdf"
          ? "pdf"
          : file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ? "docx"
            : null;
      if (!extension || file.size > 10485760)
        throw new Error("Use PDF or DOCX, up to 10 MB");
      const id = crypto.randomUUID();
      const path = `${userId}/${id}.${extension}`;
      await result(
        client.storage
          .from("resumes")
          .upload(path, file, { contentType: file.type, upsert: false }),
      );
      try {
        return await owned(
          "resumes",
          { id, name, variant, version, object_path: path },
          "id",
        );
      } catch (error) {
        await client.storage.from("resumes").remove([path]);
        throw error;
      }
    },
    resumeLink(path) {
      return result(client.storage.from("resumes").createSignedUrl(path, 60));
    },
    async latestBatch() {
      const userId = await owner();
      const rows = await result(
        client
          .from("job_batches")
          .select("id")
          .eq("user_id", userId)
          .order("batch_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
      );
      return rows.length ? this.getBatch(rows[0].id) : null;
    },
    async getBatch(id) {
      const userId = await owner();
      const batch = await result(
        client
          .from("job_batches")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single(),
      );
      const items = await result(
        client
          .from("batch_items")
          .select("*,jobs(*)")
          .eq("batch_id", id)
          .eq("user_id", userId)
          .order("position"),
      );
      return { batch, items };
    },
    async saveDraft(id, expectedRevision, draft, blocker = null) {
      const userId = await owner();
      return result(
        client
          .from("applications")
          .update({ draft, blocker })
          .eq("id", id)
          .eq("user_id", userId)
          .eq("revision", expectedRevision)
          .select()
          .single(),
      );
    },
    async setStage(id, expectedRevision, status, note = "") {
      await owner();
      return result(
        client.rpc("set_application_stage", {
          application_id: id,
          expected_revision: expectedRevision,
          target_status: status,
          note,
        }),
      );
    },
    async approve(id, expectedRevision) {
      await owner();
      return result(
        client.rpc("approve_application", {
          application_id: id,
          expected_revision: expectedRevision,
        }),
      );
    },
    async setLeaderboard(alias, optedIn) {
      await owner();
      return result(
        client.rpc("set_leaderboard_preferences", { alias, opted_in: optedIn }),
      );
    },
  };
}
export { createBackend };
