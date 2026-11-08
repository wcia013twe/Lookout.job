import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from './helpers/database.mjs';
import { checkSchema } from './helpers/schema-check.mjs';
import { checkLeaderboard } from './helpers/leaderboard-check.mjs';
import { checkApplicationPipeline } from './pipeline-check.mjs';
import {validSubmissionReceipt} from '../lib/submission-targets.mjs';

// Apply migrations once. SQL scenarios use disposable clones of the migrated
// baseline; session roles, cached plans and fixtures cannot leak between checks.
let db;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("reset role; set test.uid='';"); });

test('schema enforces owner isolation, immutable approvals and private storage', async () => {
  await checkSchema(db);
});
test('application pipeline requires submission and deduplicates stage events', async () => {
  await checkApplicationPipeline(db, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
});
test('leaderboard derives scores, deduplicates refreshes and exposes only opted-in metrics', async () => {
  await checkLeaderboard(db);
});

test('SQL and Edge bind platform receipts to the exact job and reject spoofed or negative confirmations',async()=>{
 for(const [ats,jobUrl,marker,suffix] of [
  ['greenhouse','https://job-boards.greenhouse.io/fixture/jobs/123','#confirmation','/confirmation'],
  ['ashby','https://jobs.ashbyhq.com/fixture/abc-123','h1','/application'],
  ['lever','https://jobs.eu.lever.co/fixture/abc-123','.application-received','/thanks'],
 ]){
  const receipt={source:`runner-observed-${ats}-confirmation`,jobUrl,observedUrl:jobUrl+suffix,marker,message:'Your application has been submitted.'};
  for(const patch of [{},{source:'runner-observed-workday-confirmation'},{observedUrl:jobUrl+'/other'},{observedUrl:jobUrl+suffix+'?x=1'},{marker:'body'},{message:'We have not received your application'},{message:'We previously received your application'},{message:'Form disappeared'}]){
   const value={...receipt,...patch};
   const saved=await db.query('select private.valid_submission_receipt($1) as valid',[value]);
   assert.equal(saved.rows[0].valid,validSubmissionReceipt(value),JSON.stringify(value));
   assert.equal(saved.rows[0].valid,Object.keys(patch).length===0);
  }
 }
 for(const role of ['anon','authenticated']){
  const result=await db.query("select has_function_privilege($1,'private.valid_submission_receipt(jsonb)','execute') as allowed",[role]);
  assert.equal(result.rows[0].allowed,false);
 }
});

for (const [file, behavior] of [
  ['connected-action-board','connected decisions share ownership, versioned review, durable stop fences and canonical round prep'],
  ['discover-application-jobs','Discover application jobs replay safely, isolate owners, fence worker leases and preserve submission consent'],
  ['submission-batches','submission batches pin versions, isolate owners, fence leases, replay safely and derive outcomes without consent shortcuts'],
  ['action-inbox','durable handoffs reconcile atomically, retain history, isolate owners and preserve consent'],
  ['profile-edit-flow','complete browser and MCP profile flow preserves facts, rejects stale versions and enforces human review'],
  ['work-experience','entry-level work history preserves facts, versions, scopes, ownership and website/MCP parity'],
  ['search-pipeline','scoped lead intake and screening replay atomically, isolate owners and rescreen current settings'],
  ['careerops-discovery','copied CareerOps native identities and functional URL parameters survive persisted resume reads'],
  ['backend-jobs','backend execution isolates owners, replays writes, fences leases and dispatch, and rejects retired scheduling'],
  ['agent-connection-test','lightweight agent check-in exposes owned automation settings without advancing onboarding or creating tasks'],
  ['discover-removal','Discover removal isolates owners, scopes and batches and preserves applications'],
  ['job-assessment','dynamic private assessments validate scores, preserve retries and isolate owners'],
  ['website-onboarding','website completion persists separately from agent readiness, rejects agents, isolates owners and replays safely'],
  ['simplify-import','Simplify imports retain missing URLs and source reports, preserve status, isolate owners, reject stale writes and replay safely'],
  ['workspace-reset','workspace reset preserves Auth and other owners, revokes agents, retries storage failures, blocks writes and protects replay'],
  ['card-packs','card pack settings and publication enforce ownership, versions, assigned connections, source routing and replay'],
  ['agent-workflows','partial edits and brief snapshots preserve ownership, versions, authority and website/MCP parity'],
  ['schema-evolution','typed document subjects and private discovery links preserve ownership and transport parity'],
  ['agent-activity','agent activity appends and replays without SQL argument ambiguity'],
  ['agent-connections','connections issue with current scopes, revoke durably, reject revoked tokens and isolate owners'],
  ['search-sweeps','document context and agent sweeps enforce versions, ownership, evidence and resumption'],
  ['resume-source','resume source replacement preserves files and remaps preferences with scoped transport parity'],
  ['toolkit-weekly','weekly toolkit and mock interviews preserve private profiles, lifecycle, timezone, pagination and scoped parity'],
  ['artifact-collections','prep collections enforce owned revisions, shelf expiry, pagination and website/MCP parity'],
  ['artifacts','artifacts and learning prep enforce owner isolation, revisions, retries, shared budgets and scoped parity'],
  ['toolkit-execution','toolkit outputs and document registration preserve ownership, scopes, replay and revocation'],
  ['onboarding', 'onboarding verifies first value, isolates owners, and never manufactures submission authority'],
  ['context-versions', 'settings versions advance only for the owner and remain scope-gated'],
  ['runner-failure', 'failure reports preserve drafts, reject stale writes and replay once'],
  ['submission', 'submission claims permit one click and retain observed evidence'],
  ['muse-parity', 'quiet settings and human handoffs retain scoped ownership and versions'],
  ['interview-reporting','automatic candidate reports, corrections and private notes preserve evidence, ownership, versions and website/MCP parity'],
  ['milestones', 'process milestones preserve evidence, ownership, and unknown dates'],
  ['preparation-planner', 'shared prep sessions enforce budget, atomic versions, idempotency and owner isolation'],
  ['muse-features', 'preparation, selection and notification records enforce ownership and versions'],
  ['search-profile', 'search profile UI and MCP writes share version and permission checks'],
  ['search-targets', 'target edits validate addresses and survive workspace autosync'],
  ['platform-tools', 'profile, answer and preference actions cannot forge consent'],
  ['platform-extended', 'contacts, resume intents and manual progress use bounded transitions'],
  ['platform-coverage', 'batch, resume, selection and browser actions enforce their contracts'],
]) {
  test(behavior, async () => {
    const scenarioDb = await db.clone();
    try {
      await scenarioDb.exec(await readFile(new URL(`./${file}-check.sql`, import.meta.url), 'utf8'));
    } finally {
      await scenarioDb.close();
    }
  });
}
test('browser and anonymous roles cannot invoke trusted context dispatch', async () => {
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from private.agent_settings_versions'));
  await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
  await db.exec('set role anon');
  await assert.rejects(db.query("select public.agent_dispatch('test','context.versions','{}')"));
});
