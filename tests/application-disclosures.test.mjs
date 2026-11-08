import test from 'node:test';
import assert from 'node:assert/strict';
import {answerDisclosure,draftInferences,applicationActionLabel} from '../lib/application-disclosures.mjs';
import {draftPayload,fromCloud} from '../lib/cloud-model.mjs';
test('source labels never invent human confirmation or a missing provenance',()=>{
 assert.match(answerDisclosure({answer:'Draft',answerSource:'ai_generated'}),/AI-drafted/);
 assert.match(answerDisclosure({answer:'Draft',answerSource:'inferred'}),/Inferred/);
 assert.match(answerDisclosure({answer:'Fact',profileField:'email'}),/Profile/);
 assert.match(answerDisclosure({answer:'Draft',answerSource:'user_confirmed'}),/not recorded/);
 assert.match(answerDisclosure({answer:'Draft'},{edited:true}),/not saved/);
 assert.equal(answerDisclosure({answer:' '}),'Your answer is needed');
 assert.match(answerDisclosure({answer:'Draft'}),/not recorded/);
 assert.deepEqual(draftInferences([null,{field:'Team',reason:'Unconfirmed'},{field:'Missing'}]),[{field:'Team',reason:'Unconfirmed'}]);
 for(const kind of ['prepared_application','review_application','submit_application'])assert.equal(applicationActionLabel({kind}),'Submission');
 for(const kind of ['resolve_blocker','check_submission','missing_answer'])assert.equal(applicationActionLabel({kind}),'Need your input');
});
test('sync preserves exact draft disclosures and resume selection without introducing board copies',()=>{
 const draft={resumeId:'resume-v2',inferences:[{field:'Team scope',reason:'Needs confirmation'}],coverLetter:'A draft letter',coverLetterSource:'ai_generated',questions:[{question:'Why?',answer:'Draft',answerSource:'ai_generated',questionSource:'employer_form'}]};
 const rows={profiles:[],preferences:[],resumes:[],answer_library:[],applications:[{id:'application',job_id:'job',revision:3,status:'Draft',draft}]};
 const app=fromCloud(rows).applications.job,payload=draftPayload(app);
 for(const field of Object.keys(draft))assert.deepEqual(payload[field],draft[field]);
 assert.equal(payload.backendRevision,undefined);
});


test('role widgets render saved labels without inventing a verdict from scores',async()=>{
 const {savedRoleLabel}=await import('../lib/job-assessment.mjs');
 assert.equal(savedRoleLabel({fitLabel:'Strong fit',priority:'Apply Now'}),'Strong fit');
 assert.equal(savedRoleLabel({priority:'Strong Consider'}),'Strong Consider');
 assert.equal(savedRoleLabel({matchAssessment:{percent:98}}),null);
 assert.equal(savedRoleLabel({fitLabel:'x'.repeat(81)}),null);
});
