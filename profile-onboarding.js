(function () {
  'use strict';
  const start = document.querySelector('#profile-start-setup');
  const panel = document.querySelector('#profile-onboarding');
  const form = document.querySelector('#profile-setup-form');
  const feedback = document.querySelector('#setup-feedback');
  const store = window.JB.store;
  function choices() {
    const own = form.elements.agent.value === 'own';
    document.querySelector('#setup-agent-name-label').hidden = !own;
    form.elements.agentName.required = own;
    document.querySelector('#setup-muse-help').hidden = form.elements.source.value !== 'muse';
  }
  start.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    start.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      const saved = store.get('workflow.profile') || {};
      form.elements.name.value = saved.name || '';
      form.elements.introduction.value = saved.introduction || '';
      form.elements.agent.value = saved.setupAgent === 'own' ? 'own' : 'platform';
      form.elements.agentName.value = saved.setupAgentName || '';
      form.elements.source.value = saved.profileSource === 'manual' ? 'manual' : 'muse';
      feedback.textContent = ''; choices();
      document.querySelector('#setup-heading').focus();
    }
  });
  form.addEventListener('change', choices);
  document.querySelector('#setup-close').addEventListener('click', () => {
    panel.hidden = true; start.setAttribute('aria-expanded', 'false'); start.focus();
  });
  document.querySelector('#setup-copy-muse').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#setup-muse-request').textContent);
      feedback.textContent = 'Request copied. Paste it into Muse and attach your PDF.';
    } catch { feedback.textContent = 'Select and copy the request above, then send it to Muse with your PDF.'; }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.elements.name.value.trim() || (form.elements.agent.value === 'own' && !form.elements.agentName.value.trim())) {
      feedback.textContent = 'Enter your name and, if selected, your agent’s name.'; return;
    }
    store.set('workflow.profile', { ...(store.get('workflow.profile') || {}), name: form.elements.name.value.trim(), introduction: form.elements.introduction.value.trim(), setupAgent: form.elements.agent.value, setupAgentName: form.elements.agentName.value.trim(), profileSource: form.elements.source.value, verified: false });
    document.dispatchEvent(new Event('workspace:hydrated'));
    feedback.textContent = 'Setup saved. Your profile is unverified; review the details below before using them for applications.';
  });
})();
