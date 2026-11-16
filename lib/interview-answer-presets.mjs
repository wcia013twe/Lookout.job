import {answerEntry} from './interview-prep.mjs';

export const interviewAnswerPresets = [
  {question:'Tell me about yourself',category:'Introductions and motivation'},
  {question:'Why this company?',category:'Introductions and motivation'},
  {question:'Most difficult technical challenge',category:'Project and experience stories'},
  {question:'A time you disagreed',category:'Behavioral questions'},
  {question:'Explain a system you designed',category:'Technical explanations'},
  {question:'What would you ask the interviewer?',category:'Questions to ask interviewers'},
];

const normalize = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function presetAnswer(items, preset) {
  return items.find(item => ['story_bank','application_template'].includes(item.content?.kind) &&
    normalize(answerEntry(item).question || item.content?.title) === normalize(preset.question));
}
