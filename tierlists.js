(function () {
  const store = JB.store, model = JB.tierlistModel, esc = JB.esc;
  const root = document.querySelector('#company-tierlists');
  const lists = () => store.get('workflow.tierLists') || [];
  const current = () => lists().find(l => l.id === store.get('workflow.activeTierListId')) || lists()[0];
  let selected = null, drag = null;
  function save(list) { store.set('workflow.tierLists', lists().map(l => l.id === list.id ? list : l)); }
  function feedback(text) { document.querySelector('#tierlist-feedback').textContent = text; }
  const grip = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 3h2m4 0h2M4 8h2m4 0h2M4 13h2m4 0h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function tile(company) {
    return `<div class="company-tile${selected === company.id ? ' selected' : ''}" data-company-key="${esc(company.id)}"><button type="button" class="company-select" aria-label="Select ${esc(company.name)} to move" aria-pressed="${selected === company.id}"><logo-img company="${esc(company.name)}" cls="tier-company-logo"></logo-img><span>${esc(company.name)}</span></button><button type="button" class="tier-drag-handle" aria-label="Drag ${esc(company.name)}">${grip}</button></div>`;
  }
  function render() {
    const list = current(); if (!list) return;
    document.querySelector('#tierlist-profile').innerHTML = lists().map(l => `<option value="${esc(l.id)}"${l.id === list.id ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
    document.querySelector('#tierlist-rename').elements.name.value = list.name;
    const companies = new Map(list.companies.map(c => [c.id, c]));
    document.querySelector('#tierlist-board').innerHTML = [...list.tiers, { id: 'unranked', label: 'Unranked' }].map(t => `<section class="tier-row" data-tier="${esc(t.id)}" aria-label="${esc(t.label)} tier"><div class="tier-label">${t.id === 'unranked' ? '<strong>Unranked</strong>' : `<input data-tier-label="${esc(t.id)}" value="${esc(t.label)}" aria-label="Rename ${esc(t.id)} tier" maxlength="24">`}</div><div class="tier-tiles">${(list.placements[t.id] || []).map(id => companies.has(id) ? tile(companies.get(id)) : '').join('')}<span class="tier-drop-hint">Drop here</span></div></section>`).join('');
    document.querySelector('#tierlist-destination').innerHTML = [...list.tiers, { id: 'unranked', label: 'Unranked' }].map(t => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
    document.querySelector('#tierlist-move').hidden = !selected;
    document.querySelector('#tierlist-selected').textContent = selected ? `Selected: ${companies.get(selected)?.name || ''}` : '';
  }
  function move(company, tier, before) {
    try {
      const list = current(); const name = list.companies.find(c => c.id === company)?.name;
      selected = null; save(model.move(list, company, tier, before));
      feedback(`${name} moved to ${tier === 'unranked' ? 'Unranked' : list.tiers.find(t => t.id === tier).label}. Saved.`);
      const tile = [...root.querySelectorAll('[data-company-key]')].find(el => el.dataset.companyKey === company);
      tile?.dispatchEvent(new CustomEvent('tierlist:moved', { bubbles: true }));
    } catch (error) { feedback(error.message); }
  }
  document.querySelector('#tierlist-profile').addEventListener('change', event => { selected = null; store.set('workflow.activeTierListId', event.target.value); });
  document.querySelector('#tierlist-create').addEventListener('submit', event => {
    event.preventDefault(); const name = event.target.elements.name.value.trim(); if (!name) return;
    const list = model.create(name); store.set('workflow.tierLists', [...lists(), list]); selected = null;
    store.set('workflow.activeTierListId', list.id); event.target.reset(); feedback('New list created.');
  });
  document.querySelector('#tierlist-duplicate').addEventListener('click', () => {
    const list = model.duplicate(current(), `${current().name} copy`); selected = null;
    store.set('workflow.tierLists', [...lists(), list]); store.set('workflow.activeTierListId', list.id); feedback('List duplicated.');
  });
  document.querySelector('#tierlist-rename').addEventListener('submit', event => {
    event.preventDefault(); const name = event.target.elements.name.value.trim(); if (name) save({ ...current(), name });
  });
  document.querySelector('#tierlist-company').addEventListener('submit', event => {
    event.preventDefault(); try { save(model.addCompany(current(), event.target.elements.name.value)); event.target.reset(); feedback('Company added to Unranked.'); } catch (error) { feedback(error.message); }
  });
  root.addEventListener('change', event => {
    if (!event.target.matches('[data-tier-label]')) return;
    const list = current(); const tier = list.tiers.find(t => t.id === event.target.dataset.tierLabel);
    tier.label = event.target.value.trim() || tier.id; save(list);
  });
  root.addEventListener('click', event => {
    if (event.target.closest('.company-select')) { selected = event.target.closest('[data-company-key]').dataset.companyKey; render(); }
  });
  document.querySelector('#tierlist-move-button').addEventListener('click', () => { if (selected) move(selected, document.querySelector('#tierlist-destination').value); });
  document.querySelector('#tierlist-cancel-selection').addEventListener('click', () => { selected = null; render(); });

  function dropTarget(x, y) {
    const target = document.elementFromPoint(x, y);
    const row = target?.closest('[data-tier]');
    return row && root.contains(row) ? { row, before: target.closest('[data-company-key]')?.dataset.companyKey } : null;
  }
  function cleanup() {
    if (!drag) return;
    drag.ghost.remove();
    if (drag.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer);
    root.querySelectorAll('.tier-drop-target').forEach(el => el.classList.remove('tier-drop-target'));
    drag = null;
  }
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.tier-drag-handle'); if (!handle || event.button !== 0) return;
    event.preventDefault(); cleanup();
    const tile = handle.closest('[data-company-key]'), rect = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true); ghost.classList.add('tier-drag-ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    ghost.style.width = `${rect.width}px`; ghost.style.left = `${event.clientX - rect.width / 2}px`; ghost.style.top = `${event.clientY - 24}px`;
    document.body.appendChild(ghost); handle.setPointerCapture(event.pointerId);
    drag = { handle, ghost, pointer: event.pointerId, company: tile.dataset.companyKey, listId: current().id };
    feedback(`Dragging ${current().companies.find(c => c.id === drag.company).name}. Drop on a tier.`);
  });
  root.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    event.preventDefault(); drag.ghost.style.left = `${event.clientX - drag.ghost.offsetWidth / 2}px`; drag.ghost.style.top = `${event.clientY - 24}px`;
    root.querySelectorAll('.tier-drop-target').forEach(el => el.classList.remove('tier-drop-target'));
    dropTarget(event.clientX, event.clientY)?.row.classList.add('tier-drop-target');
    if (event.clientY < 90) window.scrollBy(0, -12);
    if (event.clientY > innerHeight - 90) window.scrollBy(0, 12);
  });
  root.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const target = dropTarget(event.clientX, event.clientY), company = drag.company, listId = drag.listId;
    cleanup(); if (target && current().id === listId) move(company, target.row.dataset.tier, target.before); else feedback('Move cancelled.');
  });
  root.addEventListener('pointercancel', () => { cleanup(); feedback('Move cancelled.'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drag) { cleanup(); feedback('Move cancelled.'); } });
  store.subscribe('workflow.tierLists', render); store.subscribe('workflow.activeTierListId', render);
  if (!lists().length) {
    const list = model.create('Company preferences'); store.set('workflow.tierLists', [list]); store.set('workflow.activeTierListId', list.id);
  }
  render();
})();
