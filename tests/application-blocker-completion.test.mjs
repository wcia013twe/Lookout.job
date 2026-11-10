import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {blockerCompletionAction} from '../lib/application-disclosures.mjs';
const owner='11111111-1111-1111-1111-111111111111',hash='e'.repeat(64);

test('human task completion uses the existing scoped decision and resumes preparation without approving answers or submission',async()=>{
 const db=await createTestDatabase();
 try {
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional receiver',$2,array['workspace:read'],now()+interval '1 day')",[owner,hash]);
  for(const [key,reason] of [['sign-in','Candidate sign-in is required before application questions.'],['host','Host auto-review denied observing the authentication origin under the public-inspection-only scope.'],['verify','The employer requires a CAPTCHA.']]){
   await db.query("insert into public.jobs(id,canonical_url,employer) values($1,$2,'{}')",[key,'https://example.test/'+key]);
   const app=(await db.query("insert into public.applications(user_id,job_id,draft,blocker) values($1,$2,'{\"questions\":[],\"questionsReviewed\":false}', $3) returning *",[owner,key,reason])).rows[0];
   const item=(await db.query("select x from private.action_board_items($1) x where x->>'sourceId'=$2",[owner,app.id])).rows[0].x;
   const action=blockerCompletionAction(item);assert(action);
   const request={key:item.key,response:'accept',eventKey:crypto.randomUUID(),input:{answers:[],confirmed:true,note:action.note}};
   // Agents may inspect the handoff but cannot impersonate the human response.
   const board=(await db.query("select public.agent_dispatch($1,'actions.board.read','{}') data",[hash])).rows[0].data;
   assert(board.items.some(i=>i.key===item.key));
   await assert.rejects(db.query("select public.agent_dispatch($1,'actions.board.respond',$2)",[hash,request]));
   await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');
   await db.query('select public.respond_action_board($1)',[request]);await db.exec('reset role');
   const saved=(await db.query('select * from public.applications where id=$1',[app.id])).rows[0];
   assert.equal(saved.status,'Draft');assert.equal(saved.blocker,null);assert.equal(saved.draft.questionsReviewed,false);assert.equal(saved.receipt,null);
   assert.deepEqual(saved.draft.questions,[]);assert.equal(saved.draft.resumeId,app.draft.resumeId);
   assert.equal((await db.query('select count(*)::int n from public.approvals where application_id=$1',[app.id])).rows[0].n,0);
   const event=(await db.query("select payload from public.activity_events where kind='muse.action_decision' and payload->>'decisionKey'=$1",[item.key])).rows[0].payload;
   assert.equal(event.savedResponse.input.note,action.note);assert.equal(event.savedResponse.input.confirmed,true);
  }
 }finally{await db.close();}
});
