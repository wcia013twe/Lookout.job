import {MUSE_WORKFLOW_VERSIONS} from '../lib/muse-workflow-routing.mjs';
import {MUSE_CHANGE_TYPES} from '../lib/muse-change-feed.mjs';
import {loadWorkflowGuide} from './context-cache.mjs';

const types = new Map(MUSE_CHANGE_TYPES.map(type => [type.kind, type]));
const active = new Set();

// Optional host adapter for pointer consumption, not a scheduler or workflow
// engine. `call` uses MCP tool names. The authorized host handles domain work and
// independently verifies its persisted result/receipt before acknowledgement.
// Cross-process serialization and task leases still belong to the host/backend.
export async function consumeMuseChanges({call, handle, verify, connectionKey, guideCache, hasContext = false, maxPages = 5}) {
  if (typeof call !== 'function' || typeof handle !== 'function' || typeof verify !== 'function' ||
      typeof connectionKey !== 'string' || !connectionKey || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) {
    throw Error('Scoped caller, authorized handler, verifier and connection required');
  }
  if (active.has(connectionKey)) return {busy: true, acknowledgedIds: []};
  active.add(connectionKey);
  const acknowledgedIds = [], seen = new Set();
  let cache = hasContext ? guideCache : undefined, pending = false, developerContext;
  try {
    developerContext = !hasContext ? await call('read_developer_context', {}) : undefined;
    if (!hasContext && (!Array.isArray(developerContext?.instructions) || !Array.isArray(developerContext?.guides))) throw Error('Invalid developer context');
    for (let page = 0; page < maxPages; page++) {
      const feed = await call('read_muse_changes', {limit: 50});
      if (!Array.isArray(feed?.items) || feed.items.length > 50 || typeof feed.hasMore !== 'boolean') throw Error('Invalid change feed');
      const groups = new Map();
      for (const event of feed.items) {
        pending = true;
        const type = types.get(event.kind);
        if (!type || seen.has(event.id)) continue;
        seen.add(event.id);
        // Accept only known read destinations and matching workflow references.
        if (!event.refresh || event.refresh.tool !== type.readTool || event.workflow?.guideId !== type.workflow.guideId) continue;
        const expectedArguments = ['read_personal_context','read_agent_schedule','read_action_board'].includes(type.readTool) ? {}
          : type.readTool === 'read_search_context' ? {profileId:event.recordId}
          : type.readTool === 'read_backend_jobs' ? {jobId:event.recordId} : {applicationId:event.recordId};
        if (JSON.stringify(event.refresh.arguments) !== JSON.stringify(expectedArguments)) continue;
        const key = JSON.stringify([event.refresh.tool, event.refresh.arguments, event.workflow]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
      }
      let progressed = false;
      for (const events of groups.values()) {
        const event = events[0];
        const current = await call(event.refresh.tool, event.refresh.arguments);
        let workflow = event.workflow;
        if (event.kind === 'backend_job_finished') {
          const job = current?.jobs?.find(job => job.id === event.recordId);
          if (!job || !['search_ats','application_submit'].includes(job.kind)) continue;
          if (job.kind === 'application_submit') workflow = {guideId:'application-workspace',guideVersion:MUSE_WORKFLOW_VERSIONS['application-workspace']};
        }
        const loaded = await loadWorkflowGuide({call, connectionKey, workflow, cache, hasContext: true});
        cache = loaded.cache;
        const context = {events, current, guide: loaded.guide};
        const outcome = await handle(context);
        // Blockers need a persisted resume condition. Schedules need actual
        // scheduler reconciliation; a saved blocker cannot stand in for it.
        if (outcome?.status !== 'handled' && !(outcome?.status === 'blocked' &&
            event.kind !== 'schedule_changed' && typeof outcome.resumeCondition === 'string' && outcome.resumeCondition.trim())) continue;
        if (await verify({...context, outcome}) !== true) continue;
        const ids = events.map(item => item.id);
        await call('acknowledge_muse_changes', {eventIds: ids});
        acknowledgedIds.push(...ids);
        progressed = true;
      }
      if (!feed.hasMore || !progressed) {
        pending = feed.hasMore || feed.items.some(event => !acknowledgedIds.includes(event.id));
        break;
      }
    }
    return {busy: false, acknowledgedIds, pending, developerContext, guideCache: cache};
  } finally {
    active.delete(connectionKey);
  }
}
