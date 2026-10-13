(function () {
  const normalize = text => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  window.JB.savedAnswerModel = {
    matching(answers, question, company) {
      const key = normalize(question);
      if (!key) return [];
      return answers.filter(a => normalize(a.question) === key && (!a.companyScope || normalize(a.companyScope) === normalize(company)));
    },
    automatic(answers, question, company) {
      const matches = this.matching(answers, question, company);
      // Ambiguous matches require a person, even if one is marked automatic.
      return matches.length === 1 && matches[0].policy === 'auto' && matches[0].verifiedAt && matches[0].answer.trim() ? matches[0] : null;
    },
    save(fields, previous) {
      const question = fields.question.trim(), answer = fields.answer.trim();
      if (!question || !answer) throw new Error('Enter a question and an answer.');
      if (fields.policy === 'auto' && !fields.verified) throw new Error('Review the answer before allowing autofill.');
      return { id: previous?.id || crypto.randomUUID(), question, answer,
        policy: fields.policy === 'auto' ? 'auto' : 'ask', companyScope: fields.companyScope.trim(),
        verifiedAt: fields.verified ? new Date().toISOString() : null,
        version: (previous?.version || 0) + 1, updatedAt: new Date().toISOString() };
    },
  };
})();
