(function () {
  const store = JB.store, model = JB.savedAnswerModel, esc = JB.esc;
  const answers = () => store.get('workflow.savedAnswers') || [];
  const form = document.querySelector('#saved-answer-form');
  const list = document.querySelector('#saved-answer-list');
  const feedback = document.querySelector('#saved-answer-feedback');
  let editing = null, deleted = null;
  function render() {
    list.innerHTML = answers().map(a => `<article class="saved-answer-row"><div><strong>${esc(a.question)}</strong><p>${esc(a.answer)}</p><small>${a.policy === 'auto' && a.verifiedAt ? 'Can autofill' : 'Always ask me'} · ${esc(a.companyScope || 'Any company')}</small></div><div class="workflow-actions"><button type="button" data-edit-answer="${esc(a.id)}">Edit</button><button type="button" data-delete-answer="${esc(a.id)}">Delete</button></div></article>`).join('') || '<p class="panel-note">No saved answers yet. Add a common question and your preferred answer.</p>';
  }
  function reset() {
    editing = null; form.reset(); document.querySelector('#saved-answer-save').textContent = 'Save answer';
    document.querySelector('#saved-answer-cancel').hidden = true;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const saved = model.save({ question: form.elements.question.value, answer: form.elements.answer.value,
        policy: form.elements.policy.value, companyScope: form.elements.companyScope.value, verified: form.elements.verified.checked }, answers().find(a => a.id === editing));
      const next = answers().filter(a => a.id !== saved.id); next.push(saved); store.set('workflow.savedAnswers',next);
      reset(); feedback.textContent = 'Answer saved in this browser. Existing drafts are unchanged.';
    } catch(error) { feedback.textContent = error.message; }
  });
  list.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-answer]'), remove = event.target.closest('[data-delete-answer]');
    if (edit) {
      const answer = answers().find(a => a.id === edit.dataset.editAnswer); if (!answer) return;
      editing = answer.id;
      ['question','answer','companyScope','policy'].forEach(key => { form.elements[key].value = answer[key] || ''; });
      // Every edited version requires a fresh review; do not inherit the checkmark.
      form.elements.verified.checked = false;
      document.querySelector('#saved-answer-save').textContent = 'Save changes';
      document.querySelector('#saved-answer-cancel').hidden = false;
      form.elements.question.focus({preventScroll:true}); feedback.textContent = 'Editing saved answer.';
    }
    if (remove) {
      deleted = answers().find(a => a.id === remove.dataset.deleteAnswer);
      if (!deleted) return;
      store.set('workflow.savedAnswers',answers().filter(a => a.id !== deleted.id));
      if (editing === deleted.id) reset();
      feedback.textContent = 'Answer deleted. '; const undo = document.createElement('button'); undo.type='button'; undo.textContent='Undo';
      undo.addEventListener('click', () => { if (deleted) store.set('workflow.savedAnswers',[...answers(),deleted]); deleted=null; feedback.textContent='Answer restored.'; }); feedback.append(undo);
    }
  });
  document.querySelector('#saved-answer-cancel').addEventListener('click',reset);
  store.subscribe('workflow.savedAnswers',render); render();
})();
