const {test}=require('node:test');const assert=require('node:assert/strict');
test('cloud applications retain server revision and exact saved answer provenance',async()=>{
 const {fromCloud,draftPayload}=await import('../cloud-model.mjs');
 const rows={profiles:[{facts:{name:'One'},verified_at:'today'}],preferences:[],resumes:[],answer_library:[],applications:[{id:'db-app',job_id:'job',status:'Approved',revision:7,draft:{resumeId:'r',questionsReviewed:true,questions:[{question:'Why?',answer:'Because',savedAnswerId:'saved',savedAnswerVersion:3}]},updated_at:'today'}]};
 const w=fromCloud(rows);assert.equal(w.profile.verified,true);assert.equal(w.cloudDirty,false);assert.equal(w.applications.job.backendRevision,7);
 assert.equal(draftPayload(w.applications.job).questions[0].savedAnswerVersion,3);assert.equal(w.applications.job.approved.revision,7);
});
test('private batch maps employer facts separately from personalized recommendation',async()=>{
 const {batchRoles}=await import('../cloud-model.mjs');const roles=batchRoles([{job_id:'job',jobs:{employer:{company:'Example',title:'Engineer',location:'Remote'},canonical_url:'https://example.com'},recommendation:{whyItFits:'Personal fit',priority:'Apply Now'}}],'2026-10-13');
 assert.equal(roles[0].company,'Example');assert.equal(roles[0].whyItFits,'Personal fit');assert.equal(roles[0].discoveredDate,'2026-10-13');
});
