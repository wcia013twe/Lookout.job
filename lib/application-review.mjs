// A preview derives its decisions from recorded employer questions only.
// Reuse permission and submission validation remain backend responsibilities.
export function applicationReviewQuestions(questions = [], reviewed = false) {
  return questions.filter(question => {
    if (!question.question?.trim()) return false;
    const answered = typeof question.answer === 'string' && Boolean(question.answer.trim());
    if (!answered) return true;
    return !reviewed && !question.profileField && !question.savedAnswerId && question.fieldType !== 'file';
  });
}

// Counts describe saved controls, never approval or submission readiness.
export function applicationReviewSummary(questions = [], reviewed = false) {
 const review=applicationReviewQuestions(questions,reviewed);
 return {filled:questions.filter(q=>q.question?.trim()&&typeof q.answer==='string'&&q.answer.trim()).length,requiredUnanswered:review.filter(q=>!q.answer?.trim()&&q.required!==false).length,optionalUnanswered:review.filter(q=>!q.answer?.trim()&&q.required===false).length};
}

export function applicationReviewGroups(questions=[],reviewed=false){
 const pending=applicationReviewQuestions(questions,reviewed);
 const groups={human:[],agent:[],optional:[],browser:[]};
 for(const q of pending){
  if(q.reason&&/conflict|mismatch|invalid/.test(q.reason)){groups.human.push(q);continue;}
  if(['hidden','unsupported','multiselect','checkbox'].includes(q.fieldType)||(q.fieldType==='file'&&q.required!==false)){groups.browser.push(q);continue;}
  if(!q.answer?.trim()&&q.required===false){groups.optional.push(q);continue;}
  if(!q.answer?.trim()&&/\b(why|describe|explain|tell us|cover letter|motivation)\b/i.test(q.question)&&!/\b(sponsorship|authorization|authorized|race|gender|disability|veteran|consent)\b/i.test(q.question)&&['text','textarea',undefined].includes(q.fieldType)){groups.agent.push(q);continue;}
  groups.human.push(q);
 }
 return groups;
}
