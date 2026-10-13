(function () {
  const catalog = ['Google', 'Apple', 'Microsoft', 'Amazon', 'Meta', 'NVIDIA', 'Databricks', 'Snowflake', 'OpenAI', 'Anthropic', 'Stripe', 'Netflix', 'Uber', 'Airbnb', 'Salesforce', 'Adobe', 'Oracle', 'LinkedIn', 'AMD', 'Intel', 'Cisco', 'IBM', 'Cloudflare', 'MongoDB', 'Palantir', 'Bloomberg'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  window.JB.tierlistModel = {
    create(name) {
      const companies = catalog.map(name => ({ id: window.JB.normCompany(name), name }));
      const tiers = ['S', 'A', 'B', 'C', 'D'].map(id => ({ id, label: id }));
      return { id: uid(), name: name.trim(), companies, tiers, placements: { S: [], A: [], B: [], C: [], D: [], unranked: companies.map(c => c.id) } };
    },
    duplicate(list, name) { return { ...clone(list), id: uid(), name: name.trim() }; },
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
