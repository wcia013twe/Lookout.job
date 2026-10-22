// Fictional connections only. Returned demo tokens cannot authenticate anywhere.
export function createConnectionDemo(store) {
  const copy = value => structuredClone(value);
  return async (operation, payload = {}) => {
    if (store.get('demo.fictional') !== true) throw Error('Connections demo requires fictional storage.');
    let rows = store.get('demo.agentConnections');
    if (!rows) {
      const now = Date.now();
      rows = [
        {id:'demo-agent-active',name:'Laptop agent (demo)',scopes:['workspace:read','resumes:read','knowledge:read'],expires_at:new Date(now+30*86400000).toISOString()},
        {id:'demo-agent-revoked',name:'Previous agent (demo)',scopes:['workspace:read'],expires_at:new Date(now+86400000).toISOString(),revoked_at:new Date(now-86400000).toISOString()},
        {id:'demo-agent-expired',name:'Old test (demo)',scopes:['workspace:read'],expires_at:new Date(now-86400000).toISOString()},
      ];
      store.set('demo.agentConnections',rows);
    }
    rows = copy(rows);
    if (operation === 'connections.list') return {data:rows,supportedScopes:['workspace:read','profile:write','preferences:write','answers:write','resumes:write','network:write','tracking:write','knowledge:read','knowledge:write']};
    if (operation === 'connections.issue') {
      if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length>80) throw Error('Enter a connection name.');
      const connection={id:`demo-agent-${crypto.randomUUID()}`,name:payload.name.trim(),scopes:copy(payload.scopes),expires_at:new Date(Date.now()+30*86400000).toISOString()};
      store.set('demo.agentConnections',[connection,...rows]);
      return {connection:copy(connection),token:'demo_only_not_a_real_agent_token'};
    }
    const row=rows.find(c=>c.id===payload.id);
    if (!row) throw Error('Demo connection not found.');
    if (operation === 'connections.revoke') row.revoked_at ||= new Date().toISOString();
    else if (operation === 'connections.profile_setup') {
      if(row.revoked_at || Date.parse(row.expires_at)<=Date.now()) throw Error('Active demo connection required.');
      row.scopes=payload.enabled ? [...new Set([...row.scopes,'profile:write'])] : row.scopes.filter(s=>s!=='profile:write');
    } else throw Error('Unsupported demo connection action.');
    store.set('demo.agentConnections',rows);
    return {data:copy(row)};
  };
}
