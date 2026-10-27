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
