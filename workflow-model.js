(function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  const event = text => ({ at: new Date().toISOString(), text });
  window.JB.workflowModel = {
    create(role) {
      return { id: role.id, company: role.company, title: role.title, employmentType: role.employmentType,
        location: role.location, url: role.applicationUrl, status: 'Queued', revision: 0,
        resumeId: '', questions: [], questionsReviewed: false, blocker: '', approved: null,
        activity: [event('Application queued by you')] };
    },
    edit(draft, fields) {
      const next = { ...copy(draft), ...copy(fields) };
      const changed = ['resumeId', 'questions', 'questionsReviewed', 'blocker'].some(key => JSON.stringify(next[key]) !== JSON.stringify(draft[key]));
      if (!changed) return next;
      next.revision += 1; next.approved = null;
      next.status = next.blocker ? 'Blocked' : next.questionsReviewed ? 'Awaiting approval' : 'Draft';
      next.activity.push(event('Draft updated by you; previous approval cleared'));
      return next;
    },
    approve(draft, resume, profile) {
      if (!profile.name?.trim() || !profile.email?.trim()) throw new Error('Save your name and email in Profile first.');
      if (!profile.verified) throw new Error('Check and save your factual profile in Profile first.');
      if (!resume || resume.id !== draft.resumeId) throw new Error('Select an existing resume reference first.');
      if (!draft.questionsReviewed) throw new Error('Review the complete employer question list first.');
      if (draft.blocker) throw new Error('Resolve the blocker before approving.');
      if (draft.questions.some(q => !q.question.trim() || !q.answer.trim())) throw new Error('Every question needs an answer before approval.');
      if (draft.approved?.revision === draft.revision) return copy(draft);
      const next = copy(draft); next.status = 'Approved';
      next.approved = { revision: next.revision, at: new Date().toISOString(), resume: copy(resume), profile: copy(profile), questions: copy(next.questions) };
      next.activity.push(event('Draft approved by you; waiting for a connected runner'));
      return next;
    },
  };
})();
