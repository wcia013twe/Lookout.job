(function () {
  let config = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  window.JB.tierlistModel = {
    configure(value) {
      if (value.schemaVersion !== 1 || !Array.isArray(value.companies) || !value.companies.length || !Array.isArray(value.tiers)) throw new Error('Invalid company configuration.');
      const companyIds = new Set(value.companies.map(c => c.id));
      const tierIds = new Set(value.tiers.map(t => t.id));
      if (companyIds.size !== value.companies.length || tierIds.size !== value.tiers.length || tierIds.has('unranked')) throw new Error('Duplicate company or tier IDs.');
      for (const preset of value.presets || []) {
        const used = [];
        for (const [tier, ids] of Object.entries(preset.placements || {})) {
          if (!tierIds.has(tier) && tier !== 'unranked') throw new Error('Unknown preset tier.');
          if (!Array.isArray(ids) || ids.some(id => !companyIds.has(id))) throw new Error('Unknown preset company.');
          used.push(...ids);
        }
        if (new Set(used).size !== used.length) throw new Error('Duplicate preset placement.');
      }
      config = clone(value);
    },
    create(name) {
      if (!config) throw new Error('Company configuration has not loaded yet.');
      const companies = clone(config.companies), tiers = clone(config.tiers);
      const placements = Object.fromEntries(tiers.map(t => [t.id, []]));
      placements.unranked = companies.map(c => c.id);
      return { id: uid(), name: name.trim(), companies, tiers, placements };
    },
    seed(preset) {
      const list = this.create(preset.name);
      Object.entries(preset.placements).forEach(([tier, ids]) => { list.placements[tier] = clone(ids); });
      const used = new Set(Object.entries(list.placements).filter(([tier]) => tier !== 'unranked').flatMap(([, ids]) => ids));
      list.placements.unranked = list.companies.map(c => c.id).filter(id => !used.has(id));
      return { ...list, presetKey: preset.key, employmentType: preset.employmentType, description: preset.description, rankingBasis: config.rankingBasis, notes: clone(preset.notes || {}) };
    },
    duplicate(list, name) { const next = { ...clone(list), id: uid(), name: name.trim() }; delete next.presetKey; return next; },
    move(list, companyId, tierId, beforeId) {
      if (!list.companies.some(c => c.id === companyId)) throw new Error('Unknown company.');
      if (tierId !== 'unranked' && !list.tiers.some(t => t.id === tierId)) throw new Error('Unknown tier.');
      if (beforeId === companyId) return clone(list);
      const next = clone(list);
      Object.keys(next.placements).forEach(key => { next.placements[key] = next.placements[key].filter(id => id !== companyId); });
      const bucket = next.placements[tierId];
      const index = beforeId ? bucket.indexOf(beforeId) : -1;
      bucket.splice(index < 0 ? bucket.length : index, 0, companyId);
      return next;
    },
    addCompany(list, name) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a company name.');
      if (list.companies.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('That company already has a tile.');
      const next = clone(list), id = `custom-${uid()}`;
      next.companies.push({ id, name: trimmed }); next.placements.unranked.push(id);
      return next;
    },
  };
})();
