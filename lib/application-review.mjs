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
