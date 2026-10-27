import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationReviewQuestions } from '../lib/application-review.mjs';
import { discoverPreviewRoles } from '../next-app/lib/discover-preview-demo.mjs';

test('review contains only recorded custom decisions and unanswered fields', () => {
  const missing = { question: 'Start date?', answer: '' };
  const custom = { question: 'Why this team?', answer: 'Systems work.' };
  const questions = [
    { question: 'Email', answer: 'me@example.com', profileField: 'email' },
    { question: 'Authorization', answer: 'Yes', savedAnswerId: 'saved' },
    { question: 'Resume', answer: 'resume-id', fieldType: 'file' },
    missing, custom, { question: ' ', answer: '' },
  ];
  assert.deepEqual(applicationReviewQuestions(questions), [missing, custom]);
  assert.deepEqual(applicationReviewQuestions(questions, true), [missing]);
  assert.deepEqual(applicationReviewQuestions(), []);
});

test('demo covers one custom decision, multiple decisions and no custom input', () => {
  assert.deepEqual(discoverPreviewRoles('2026-10-23').map(role => applicationReviewQuestions(role.reviewPreview).length), [1, 2, 0]);
});

test('preview distinguishes filled answers from required and optional unanswered controls',async()=>{
 const {applicationReviewSummary}=await import('../lib/application-review.mjs');
 assert.deepEqual(applicationReviewSummary([{question:'Email',answer:'example@example.test',profileField:'email'},{question:'Location',answer:'',required:true},{question:'Cover letter',answer:'',required:false},{question:'Why us?',answer:'Draft answer'}]),{filled:2,requiredUnanswered:1,optionalUnanswered:1});
});

test('HITL excludes blank optional controls and routes required writing to the agent',async()=>{
 const {applicationReviewGroups}=await import('../lib/application-review.mjs');
 const qs=[{question:'Location',required:true,answer:''},{question:'Race',required:false,answer:''},{question:'Cover Letter',required:false,fieldType:'file',answer:''},{question:'Cover Letter',required:false,fieldType:'textarea',answer:''},{question:'Why this company?',required:true,fieldType:'textarea',answer:''},{question:'Privacy consent',required:true,fieldType:'checkbox',answer:''}];
 const g=applicationReviewGroups(qs);assert.deepEqual(g.human.map(q=>q.question),['Location']);assert.deepEqual(g.agent.map(q=>q.question),['Why this company?']);assert.equal(g.optional.length,3);assert.equal(g.browser.length,1);assert.ok(qs.every(q=>q.answer===''));
});

test('personal facts and conflicting options are not misrouted as agent writing or skippable options',async()=>{
 const {applicationReviewGroups}=await import('../lib/application-review.mjs');const g=applicationReviewGroups([{question:'Years of experience?',required:true,fieldType:'text',answer:''},{question:'Why do you need sponsorship?',required:true,fieldType:'textarea',answer:''},{question:'Availability',required:false,answer:'',reason:'conflicting-application-preference'},{question:'Resume',required:true,fieldType:'file',answer:''}]);
 assert.equal(g.human.length,3);assert.equal(g.agent.length,0);assert.equal(g.optional.length,0);assert.equal(g.browser.length,1);
});
