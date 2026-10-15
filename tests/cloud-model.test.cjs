const {test}=require('node:test');const assert=require('node:assert/strict');
test('cloud applications retain server revision and exact saved answer provenance',async()=>{
 const {fromCloud,draftPayload}=await import('../lib/cloud-model.mjs');
 const rows={profiles:[{facts:{name:'One'},verified_at:'today'}],preferences:[],resumes:[],answer_library:[],applications:[{id:'db-app',job_id:'job',status:'Approved',revision:7,draft:{resumeId:'r',questionsReviewed:true,questions:[{question:'Why?',answer:'Because',savedAnswerId:'saved',savedAnswerVersion:3}]},updated_at:'today'}]};
 const w=fromCloud(rows);assert.equal(w.profile.verified,true);assert.equal(w.cloudDirty,false);assert.equal(w.applications.job.backendRevision,7);
 assert.equal(draftPayload(w.applications.job).questions[0].savedAnswerVersion,3);assert.equal(w.applications.job.approved.revision,7);
});
test('private batch maps employer facts separately from personalized recommendation',async()=>{
 const {batchRoles}=await import('../lib/cloud-model.mjs');const roles=batchRoles([{job_id:'job',jobs:{employer:{company:'Example',title:'Engineer',location:'Remote'},canonical_url:'https://example.com'},recommendation:{whyItFits:'Personal fit',priority:'Apply Now'}}],'2026-10-13');
 assert.equal(roles[0].company,'Example');assert.equal(roles[0].whyItFits,'Personal fit');assert.equal(roles[0].discoveredDate,'2026-10-13');
});
test('cloud hydration keeps submission evidence and the ordered agent/user timeline',async()=>{
 const {fromCloud}=await import('../lib/cloud-model.mjs');
 const rows={profiles:[],preferences:[],resumes:[{id:'resume',name:'Master',variant:'Backend'}],answer_library:[],applications:[{id:'app',job_id:'job',status:'Submitted',revision:2,draft:{},submitted_at:'today',receipt:{confirmation:'ABC'},updated_at:'today'}],activity_events:[{id:'two',application_id:'app',occurred_at:'2026-10-14',kind:'submitted',actor:'agent',payload:{text:'Receipt saved'}},{id:'other',application_id:'different',occurred_at:'2026-10-13',kind:'draft',payload:{}},{id:'one',application_id:'app',occurred_at:'2026-10-13',kind:'queued',actor:'user',payload:{}}]};
 const workspace=fromCloud(rows);assert.equal(workspace.resumes[0].variant,'Backend');assert.equal(workspace.applications.job.receipt.confirmation,'ABC');assert.equal(workspace.applications.job.submittedAt,'today');assert.deepEqual(workspace.applications.job.activity.map(event=>event.id),['one','two']);assert.equal(workspace.applications.job.activity[1].text,'Receipt saved');
});
test('runner evidence survives hydration and draft sync without leaking arbitrary UI metadata',async()=>{
 const {fromCloud,draftPayload}=await import('../lib/cloud-model.mjs');
 const rows={profiles:[],preferences:[],resumes:[],answer_library:[],applications:[{id:'app',job_id:'job',revision:3,status:'Draft',draft:{resumeId:'resume',resumeSha256:'abc123',formFingerprint:'fingerprint',questionsReviewed:true,questions:[{fieldId:'field-1',question:'Why?',answer:'Because'}],unexpectedClientField:'private'}}]};
 const application=fromCloud(rows).applications.job,payload=draftPayload(application);
 assert.equal(payload.resumeSha256,'abc123');assert.equal(payload.formFingerprint,'fingerprint');assert.equal(payload.questions[0].fieldId,'field-1');assert.equal('unexpectedClientField' in payload,false);assert.equal('backendRevision' in payload,false);
});
test('search preference hydration preserves custom agent keys alongside UI fields',async()=>{
 const {fromCloud}=await import('../lib/cloud-model.mjs');const search={locations:['San Francisco'],employmentTypes:['FT'],targetYear:2027,agentFilters:{remoteOnly:true}};
 const rows={profiles:[],preferences:[{search}],resumes:[],answer_library:[],applications:[]};assert.deepEqual(fromCloud(rows).searchPreferences,search);
});
test('cloud hydration preserves the pack texture in the shared theme preference',async()=>{
 const {fromCloud}=await import('../lib/cloud-model.mjs');
 const base={profiles:[],resumes:[],answer_library:[],applications:[]};
 assert.equal(fromCloud({...base,preferences:[{theme:{pack:'lagoon',messages:{batch_ready:'Ready'}}}]}).theme.pack,'lagoon');
 assert.deepEqual(fromCloud({...base,preferences:[]}).theme,{pack:'base'});
});
test('sparse agent drafts use canonical employer identity before human approval',async()=>{
 const {fromCloud,draftPayload}=await import('../lib/cloud-model.mjs');
 const rows={profiles:[],preferences:[],resumes:[],answer_library:[],applications:[{id:'app',job_id:'job',revision:1,status:'Draft',draft:{company:'Invented',resumeId:'resume',questions:[{fieldId:'why',question:'Why?',answer:'Fit'}]},jobs:{canonical_url:'https://jobs.example.com/job',employer:{company:'Canonical',title:'Engineer',employmentType:'FT',location:'Remote'}}}]};
 const application=fromCloud(rows).applications.job,payload=draftPayload(application);assert.equal(application.company,'Canonical');assert.equal(application.title,'Engineer');assert.equal(payload.url,'https://jobs.example.com/job');assert.equal(payload.questions[0].fieldId,'why');
});
test('expanded profile facts survive cloud hydration without coercing nested records',async()=>{
 const {fromCloud}=await import('../lib/cloud-model.mjs');
 const facts={name:'One',github:'https://github.com/example',skills:'Python\nSQL',languages:'Mandarin',workExperience:[{title:'Engineer',company:'Example',current:true,description:'Built systems'}],education:[{school:'University',degree:'Master',gpa:'3.57'}],projects:[{name:'Project',url:'https://example.com'}]};
 const result=fromCloud({profiles:[{facts,verified_at:'today'}],preferences:[],resumes:[],answer_library:[],applications:[]});
 for(const key of Object.keys(facts)) assert.deepEqual(result.profile[key],facts[key]);
 assert.equal(result.profile.verified,true);
});
test('agent-imported saved answers retain their proposed policy without becoming verified',async()=>{
 const {fromCloud}=await import('../lib/cloud-model.mjs');
 const rows={profiles:[],preferences:[],resumes:[],applications:[],answer_library:[{id:'proposal',question:'Q',answer:'A',provenance:'agent',autofill_policy:'ask',verified_at:null,context:{version:1,requestedPolicy:'auto'}}]};
 const answer=fromCloud(rows).savedAnswers[0];assert.equal(answer.imported,true);assert.equal(answer.requestedPolicy,'auto');assert.equal(answer.policy,'ask');assert.equal(answer.verifiedAt,null);
});
