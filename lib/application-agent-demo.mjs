import {applicationAgentEligible,validateApplicationAgent} from './application-agent.mjs';
import {createConnectionDemo} from './agent-connections-demo.mjs';
export function createApplicationAgentDemo(store){
 async function readApplicationAgent(){
  const {data}=await createConnectionDemo(store)('connections.list');
  const saved=store.get('demo.applicationAgent')||{connectionId:null,version:0,updatedAt:null};
  const connection=data.find(c=>c.id===saved.connectionId);
  return {...saved,connectionName:connection?.name||null,available:applicationAgentEligible(connection)};
 }
 return {readApplicationAgent,async selectApplicationAgent(payload){
  validateApplicationAgent('applications.agent.select',payload);
  const current=await readApplicationAgent();
  if(current.version!==payload.expectedVersion)throw Error('Application agent changed; read again');
  const {data}=await createConnectionDemo(store)('connections.list');
  if(!data.some(c=>c.id===payload.connectionId&&applicationAgentEligible(c)))throw Error('Choose an active owned agent with application permissions');
  if(current.connectionId!==payload.connectionId)store.set('demo.applicationAgent',{connectionId:payload.connectionId,version:current.version+1,updatedAt:new Date().toISOString()});
  return readApplicationAgent();
 }};
}
