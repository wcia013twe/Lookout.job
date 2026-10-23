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
