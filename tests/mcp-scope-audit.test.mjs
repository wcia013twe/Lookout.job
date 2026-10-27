import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {TOOLS,requiredToolScopes,CONDITIONAL_TOOL_SCOPES} from '../supabase/functions/agent-mcp/protocol.mjs';

// Exercise the actual SQL authorization boundary with only the scopes advertised
// by discovery. Empty arguments intentionally stop at argument/owned-record
// validation; no business write should survive the rollback. This does not prove
// payload validity, row-dependent scopes, or deployed MCP availability.
const derivedAuthorization={
  'guides.read':'context.versions','guides.discover':'context.versions',
  'workspace.reset_handoff':'context.versions','applications.policy':'context.personal',
  'preparation.update':'preparation.read','preparation.complete':'preparation.read',
  'selection.record':'context.personal',
};
async function authorize(db,hash,operation,payload) {
  if(operation.startsWith('backend.'))return db.query('select public.backend_job_dispatch($1,$2,$3)',[hash,operation,payload]);
  if(operation.startsWith('outreach.'))return db.query('select public.agent_outreach_dispatch($1,$2,$3)',[hash,operation,payload]);
  if(operation==='submission.batch.read')return db.query('select public.agent_dispatch($1,$2,$3)',[hash,operation,payload]);
  if(operation==='submission.finish')return db.query("select public.runner_submission_transition($1,'finish',$2)",[hash,payload]);
  if(operation.startsWith('submission.'))return db.query('select public.runner_submission_context($1,null)',[hash]);
  return db.query('select public.agent_dispatch($1,$2,$3)',[hash,derivedAuthorization[operation]||operation,payload]);
}

test('MCP advertised mandatory scopes pass the owning SQL authorization boundary',async()=>{
  const db=await createTestDatabase();
  const hash='7'.repeat(64),owner='11111111-1111-1111-1111-111111111111';
  const failures=[];
  try {
    await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Fictional scope audit',$2,array['workspace:read'],now()+interval '1 day')",[owner,hash]);
    for(const tool of TOOLS) {
      const variants=[{},...(CONDITIONAL_TOOL_SCOPES[tool.operation]||[]).map(rule=>({[rule.field]:rule.value}))];
      for(const payload of variants) {
        await db.exec('begin');
        try {
          await db.query('update private.agent_connections set scopes=$1 where token_hash=$2',[requiredToolScopes(tool,payload),hash]);
          try {await authorize(db,hash,tool.operation,payload);}
          catch(error) {
            // An insufficient-privilege failure here means discovery promised
            // a tool which its exact mandatory scopes cannot authorize.
            if(error.code==='42501')failures.push({tool:tool.name,payload,scopes:requiredToolScopes(tool,payload),error:error.message});
            else assert.ok(['22023','22P02','23502','23514','40001','P0002'].includes(error.code),`${tool.name}: unexpected SQL error ${error.code}: ${error.message}`);
          }
        } finally {await db.exec('rollback');}
      }
    }
    assert.deepEqual(failures,[],'Advertised tool scopes differ from SQL/gateway authorization');
  } finally {await db.close();}
});
