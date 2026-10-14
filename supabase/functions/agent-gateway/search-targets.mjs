export const targetKinds = { board: 'Job board', careers: 'Company careers page', social: 'Social account' };
export function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length > 100) throw Error('Use up to 100 search targets.');
  const ids = new Set(), addresses = new Set();
  for (const t of targets) {
    if (!t || Object.keys(t).some(k => !['id','name','kind','address'].includes(k)) || typeof t.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(t.id) || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 120 || !Object.hasOwn(targetKinds,t.kind) || typeof t.address !== 'string' || t.address.length > 2048) throw Error('Each target needs a name, source type, and URL or social handle.');
    if (!/^https:\/\/[^\s/]+[^\s]*$/.test(t.address) && !(t.kind === 'social' && /^@[a-zA-Z0-9_.]{1,80}$/.test(t.address))) throw Error('Use an HTTPS URL, or an @handle for a social account.');
    const address = `${t.kind}:${t.address.toLowerCase().replace(/\/$/,'')}`;
    if (ids.has(t.id) || addresses.has(address)) throw Error('This source is already in your target list.');
    ids.add(t.id); addresses.add(address);
  }
  return targets;
}
export function scanningStatus(target) {
  return target.kind === 'social' ? { label: 'Forward content', detail: 'Forward posts or stories to Muse. Automatic social access is not connected.' } : { label: 'Scanning needs verification', detail: 'Muse can try this public page with its browsing tools. Automatic scanning support has not been verified; forward content if access fails.' };
}
