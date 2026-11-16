import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interviewAnswerPresets,presetAnswer} from '../lib/interview-answer-presets.mjs';
import {answerCategories} from '../lib/interview-prep.mjs';

test('starter questions span the five answer categories without fabricating saved answers', () => {
  assert.equal(new Set(interviewAnswerPresets.map(preset=>preset.category)).size,5);
  for (const preset of interviewAnswerPresets) {
    assert.ok(answerCategories.includes(preset.category));
    assert.equal(presetAnswer([],preset),undefined);
    assert.equal(preset.answer,undefined);
  }
});

test('presets reuse saved answers by question, not category or company', () => {
  const preset=interviewAnswerPresets[0];
  const saved={id:'owned-answer',content:{kind:'story_bank',title:'My introduction',body:'## Question\nTell me about yourself?\n\n## Answer\nMy own answer'}};
  assert.equal(presetAnswer([saved],preset),saved);
  assert.equal(presetAnswer([saved],interviewAnswerPresets[1]),undefined);
  assert.equal(presetAnswer([{content:{kind:'notes',title:preset.question}}],preset),undefined);
  assert.equal(presetAnswer([{content:{kind:'story_bank',title:preset.question}}],preset)?.content.title,preset.question);
});
