import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
import { fromCloud } from '../lib/cloud-model.mjs';
const id='11111111-1111-1111-1111-111111111111';
const payload={applicationId:id,eventKey:'email:message:technical',kind:'technical_round',label:'Technical round',occurredAt:null,phase:'scheduled',source:{kind:'email',messageId:'message',subject:'Next round',excerpt:'We will arrange a time shortly.',receivedAt:'2026-10-14T12:00:00Z'}};
test('milestone contract requires bounded email evidence, leaves unknown dates null and forbids arbitrary owners',()=>{
 validateRequest({operation:'applications.milestone',payload});
 validateRequest({operation:'applications.milestone',payload:{...payload,occurredAt:'2026-10-20T14:00:00-04:00',source:{...payload.source,timestampConfirmed:true}}});
 for(const bad of [{...payload,userId:id},{...payload,source:{kind:'user'}},{...payload,source:{...payload.source,excerpt:''}},{...payload,occurredAt:'2026-10-20'},{...payload,occurredAt:'2026-10-20T14:00:00Z'},{...payload,kind:'approved'}]) assert.throws(()=>validateRequest({operation:'applications.milestone',payload:bad}));
 assert.equal(TOOLS.find(t=>t.operation==='applications.milestone').scope,'activity:write');
 assert.equal(TOOLS.find(t=>t.operation==='applications.timeline').scope,'workspace:read');
});
test('hydration associates only owned application milestones and immutable confirmed resume metadata',()=>{
 const rows={profiles:[],preferences:[],answer_library:[],resumes:[{id:'current',name:'Changed résumé',version:9}],applications:[{id,job_id:'job',status:'Submitted',draft:{resumeId:'current'}}],application_milestones:[{id:'m',application_id:id,kind:'technical_round',phase:'scheduled',occurred_at:null,created_at:'2026-10-14T12:00:00Z'},{id:'foreign',application_id:'other'}],submission_attempts:[{id:'attempt',application_id:id,state:'confirmed',created_at:'2026-10-13',resume_snapshot:{id:'old',name:'Submitted résumé',version:2,content_hash:'old-hash'}},{id:'draft-attempt',application_id:id,state:'uncertain',created_at:'2026-10-14',resume_snapshot:{id:'current',version:9}}]};
 const app=fromCloud(rows).applications.job;
 assert.equal(app.status,'Submitted');
 assert.equal(app.milestones.length,1);
 assert.equal(app.milestones[0].occurred_at,null);
 assert.deepEqual(app.submittedResume,{id:'old',name:'Submitted résumé',version:2,variant:null,contentHash:'old-hash'});
 assert.equal(app.resumeId,'current');
 const missing=fromCloud({...rows,submission_attempts:[]}).applications.job;
 assert.equal(missing.submittedResume,null);
});
