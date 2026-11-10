export const APPLICATION_AGENT_SCOPES=Object.freeze(['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read']);
export function applicationAgentEligible(connection,now=Date.now()) {
 return !!connection&&!connection.revoked_at&&Date.parse(connection.expires_at)>now&&APPLICATION_AGENT_SCOPES.every(scope=>connection.scopes?.includes(scope));
}
export function validateApplicationAgent(operation,payload){
 if(!['applications.agent.read','applications.agent.select'].includes(operation))return false;
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Application agent arguments required');
 if(operation==='applications.agent.read'){if(Object.keys(payload).length)throw Error('No routing read arguments accepted');return payload;}
 if(Object.keys(payload).some(k=>!['connectionId','expectedVersion'].includes(k))||typeof payload.connectionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.connectionId)||!Number.isInteger(payload.expectedVersion)||payload.expectedVersion<0||payload.expectedVersion>999999999)throw Error('Owned connection and current routing version required');
 return payload;
}
