// Host supplies a persistent per-connection cache and restores retained context.
// Save returned cache only AFTER applying updates to the agent's persistent context.
export async function refreshAgentContext({ call, cache, connectionKey, hasContext = false }) {
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

// Cache actual content, not only version numbers. Hosts discard this cache when
// context is compacted/lost; a connection switch can never reuse another guide.
export async function loadWorkflowGuide({call, connectionKey, workflow, cache = {}, hasContext = true}) {
  if (typeof call !== 'function' || !connectionKey || typeof connectionKey !== 'string' ||
      !workflow || typeof workflow.guideId !== 'string' || !Number.isSafeInteger(workflow.guideVersion) || workflow.guideVersion < 1) {
    throw Error('Connection and versioned workflow reference required');
  }
  const retained = hasContext && cache.connectionKey === connectionKey ? cache.guides || {} : {};
  let guide = Object.hasOwn(retained, workflow.guideId) ? retained[workflow.guideId] : undefined;
  if (!guide || guide.version !== workflow.guideVersion || typeof guide.instructions !== 'string' || !guide.instructions.trim()) {
    guide = await call('read_guide', {id: workflow.guideId});
    if (guide?.id !== workflow.guideId || !Number.isSafeInteger(guide.version) || guide.version < workflow.guideVersion ||
        typeof guide.instructions !== 'string' || !guide.instructions.trim()) throw Error('Invalid or stale workflow guide');
  }
  return {guide: structuredClone(guide), cache: {connectionKey, guides: {...retained, [guide.id]: structuredClone(guide)}}};
}
