// Host supplies a persistent per-connection cache and restores retained context.
// Save returned cache only AFTER applying updates to the agent's persistent context.
export async function refreshAgentContext({ call, cache, connectionKey, hasContext = true }) {
  if (typeof call !== 'function' || typeof connectionKey !== 'string' || !connectionKey) throw new Error('Gateway caller and stable connection key required');
  const validVersion = value => Number.isSafeInteger(value) && value > 0;
  const versions = await call('context.versions', {});
  if (!validVersion(versions?.personalVersion) || !validVersion(versions?.developerVersion)) throw new Error('Invalid context versions');
  const retained = hasContext && cache?.connectionKey === connectionKey;
  const updates = {};
  let personalVersion = cache?.personalVersion, developerVersion = cache?.developerVersion;
  if (!retained || personalVersion !== versions.personalVersion) {
    const personal = await call('context.personal', {});
    if (!validVersion(personal?.personalVersion) || !personal.settings || typeof personal.settings !== 'object') throw new Error('Invalid personal context');
    updates.personal = personal.settings;
    personalVersion = personal.personalVersion;
  }
  if (!retained || developerVersion !== versions.developerVersion) {
    const developer = await call('context.developer', {});
    if (!validVersion(developer?.developerVersion) || !Array.isArray(developer.instructions)) throw new Error('Invalid developer context');
    updates.developer = developer;
    developerVersion = developer.developerVersion;
  }
  return { cache: { connectionKey, personalVersion, developerVersion }, updates };
}
