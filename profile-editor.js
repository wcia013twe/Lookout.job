/* Structured candidate facts shared by the current UI and future React surfaces. */
(function () {
  const { scalarFields, schemas } = window.JB.profileSchema;
  window.JB.profileEditor = function (form) {
    let serial = 0;
    const api = { fields: scalarFields, onStructureChange: null };
    function add(kind, value = {}, focus = false) {
      const row = document.createElement('fieldset');
      row.className = 'profile-entry';
      row.dataset.profileEntry = kind;
      const legend = document.createElement('legend');
      legend.textContent = { workExperience: 'Position', education: 'School', projects: 'Project' }[kind];
      row.append(legend);
      const grid = document.createElement('div');
      grid.className = 'workflow-form';
      const index = ++serial;
      schemas[kind].forEach(([key, text, type = 'text', autocomplete = 'off']) => {
        const label = document.createElement('label');
        const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') input.type = type;
        input.id = `${kind}_${index}_${key}`;
        input.name = `${kind}[${index}][${key}]`;
        input.dataset.profileField = key;
        input.autocomplete = autocomplete === 'off' ? 'off' : `section-${kind}${index} ${autocomplete}`;
        label.htmlFor = input.id;
        label.append(document.createTextNode(text), input);
        if (type === 'checkbox') { input.checked = value[key] === true; label.className = 'workflow-check'; }
        else input.value = typeof value[key] === 'string' ? value[key] : '';
        if (type === 'textarea') label.className = 'workflow-wide';
        grid.append(label);
      });
      row.append(grid);
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = `Remove ${legend.textContent.toLowerCase()}`;
      remove.addEventListener('click', () => { row.remove(); updateEmpty(kind); api.onStructureChange?.(); form.querySelector(`[data-profile-add="${kind}"]`).focus(); });
      row.append(remove);
      form.querySelector(`[data-profile-list="${kind}"]`).append(row);
      updateEmpty(kind);
      if (focus) grid.querySelector('input').focus();
    }
    function updateEmpty(kind) {
      const list = form.querySelector(`[data-profile-list="${kind}"]`);
      list.querySelector('.profile-empty')?.remove();
      if (!list.querySelector('[data-profile-entry]')) { const empty = document.createElement('p'); empty.className = 'profile-empty'; empty.textContent = 'No entries added yet.'; list.append(empty); }
    }
    api.read = () => {
      const facts = Object.fromEntries(scalarFields.map(key => [key, form.elements[key].value.trim()]));
      Object.keys(schemas).forEach(kind => {
        facts[kind] = [...form.querySelectorAll(`[data-profile-entry="${kind}"]`)].map(row => Object.fromEntries([...row.querySelectorAll('[data-profile-field]')].map(input => [input.dataset.profileField, input.type === 'checkbox' ? input.checked : input.value.trim()])));
      });
      return facts;
    };
    api.hydrate = facts => {
      scalarFields.forEach(key => { form.elements[key].value = typeof facts[key] === 'string' ? facts[key] : ''; });
      Object.keys(schemas).forEach(kind => {
        form.querySelector(`[data-profile-list="${kind}"]`).replaceChildren();
        (Array.isArray(facts[kind]) ? facts[kind] : []).forEach(value => { if (value && typeof value === 'object') add(kind, value); });
        updateEmpty(kind);
      });
      const name = facts.name || [facts.firstName, facts.lastName].filter(Boolean).join(' ');
      document.querySelector('#candidate-profile-heading').textContent = name || 'My Profile';
      document.querySelector('#profile-initials').textContent = name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() : '?';
      document.querySelector('#profile-headline').textContent = [facts.headline, facts.currentEmployer].filter(Boolean).join(' @ ') || 'Add your details to prepare job applications.';
    };
    form.querySelectorAll('[data-profile-add]').forEach(button => button.addEventListener('click', () => { add(button.dataset.profileAdd, {}, true); api.onStructureChange?.(); }));
    return api;
  };
})();
