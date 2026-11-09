import test from 'node:test';
import assert from 'node:assert/strict';
import {answerDisclosure,draftInferences,applicationActionLabel,showAnswerOnCard} from '../lib/application-disclosures.mjs';
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

test('application cards focus on unresolved and proposed answers without hiding unrecorded provenance',()=>{
 const questions=[
  {question:'Email',answer:'candidate@example.com',profileField:'email'},
  {question:'Start date',answer:'',preferenceField:'startDate'},
  {question:'Salary',answer:'95000',answerSource:'inferred'},
  {question:'Why this role?',answer:'Draft prose',answerSource:'ai_generated'},
  {question:'Authorization',answer:'Yes',savedAnswerId:'known-answer'},
  {question:'Location preference',answer:'Remote',preferenceField:'workSetting'},
  {question:'Unrecorded answer',answer:'Needs review'},
  {question:'Hidden field',answer:'',fieldType:'hidden'},
 ];
 assert.deepEqual(questions.filter(showAnswerOnCard).map(q=>q.question),['Start date','Salary','Why this role?','Unrecorded answer']);
 assert.equal(questions.length,8);assert.equal(questions[0].answer,'candidate@example.com');
});

test('login and host permission handoffs are completion tasks rather than empty answer reviews',async()=>{
 const {blockerCompletionAction}=await import('../lib/application-disclosures.mjs');
 const task=reason=>blockerCompletionAction({kind:'resolve_blocker',questions:[],reason});
 assert.equal(task('Apply Manually requires Create Account/Sign In before Application Questions.').kind,'sign_in');
 assert.equal(task('Complete candidate sign-in through a secure supported browser session.').kind,'sign_in');
 const permission=task('Host auto-review denied observing the authentication origin under the public-inspection-only scope.');
 assert.equal(permission.kind,'host_permission');assert.match(permission.instruction,/cannot change/);
 assert.match(permission.label,/Access approved/);assert.match(permission.note,/I approved/);
 assert.equal(task('The employer requires a CAPTCHA.').kind,'verification');
 assert.equal(task('The host cannot enter the password; human secure entry is required.').kind,'secure_entry');
 assert.equal(task('Rank your preferred office locations.'),null,'An actual personal decision still needs an answer');
 assert.equal(task('No sign-in is required. Choose your location.'),null);
 assert.equal(blockerCompletionAction({kind:'resolve_blocker',reason:'Sign in to continue',questions:[{question:'When can you start?',answer:''}]}),null,'Keep real unanswered questions visible');
 assert.equal(blockerCompletionAction({kind:'check_submission',reason:'Complete sign-in',questions:[]}),null,'Never replace uncertain-submission recovery');
});

test('employer sign-in links use saved HTTP destinations and reject executable or credential-bearing URLs',async()=>{
 const {applicationEmployerUrl}=await import('../lib/application-disclosures.mjs');
 assert.equal(applicationEmployerUrl({url:'https://employer.example/jobs/123'}),'https://employer.example/jobs/123');
 assert.equal(applicationEmployerUrl({url:'#',applicationUrl:'https://employer.example/apply'}),'https://employer.example/apply');
 for(const url of ['javascript:alert(1)','data:text/html,test','https://secret:password@employer.example/','/applications/'])assert.equal(applicationEmployerUrl({url}),null);
});

test('fieldless Workday and direct company-site blockers return a manual link handoff',async()=>{
 const {blockerCompletionAction}=await import('../lib/application-disclosures.mjs');
 const item={kind:'resolve_blocker',questions:[],reason:'Sign in to continue'};
 for(const url of ['https://employer.wd5.myworkdayjobs.com/en-US/jobs/job/Engineer','https://www.amazon.jobs/en/jobs/123','https://careers.company.example/job/123'])assert.equal(blockerCompletionAction(item,{url}).kind,'manual_application');
 assert.equal(blockerCompletionAction({...item,reason:'Manual application handoff: continue at employer.'}).kind,'manual_application');
 assert.equal(blockerCompletionAction(item,{url:'https://job-boards.greenhouse.io/company/jobs/123'}).kind,'sign_in');
 assert.equal(blockerCompletionAction({...item,kind:'check_submission'},{url:'https://careers.company.example/job/123'}),null);
});
