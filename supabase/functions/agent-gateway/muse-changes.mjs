const uuid={type:'string',format:'uuid'};
export const MUSE_CHANGE_TOOLS=[
 {name:'read_muse_changes',operation:'changes.read',scope:'workspace:read',readOnly:true,description:'Read up to 50 pending compact workspace changes for THIS connection: confirmed answers, job preferences/search profiles and finished backend jobs. Contains record IDs/versions, never answer or document bodies. Read affected records before continuing. Reading never acknowledges, wakes Muse, grants approval or authorizes submission.',inputSchema:{type:'object',additionalProperties:false,properties:{limit:{type:'integer',minimum:1,maximum:50}}}},
 {name:'acknowledge_muse_changes',operation:'changes.ack',scope:'activity:write',requiredScopes:['workspace:read'],description:'After handling specific change events or durably recording their blocker, acknowledge only those IDs for THIS connection. Idempotent retries; other pending events and other connections remain untouched. This is work-consumption acknowledgement, not notification delivery, consent or approval.',inputSchema:{type:'object',additionalProperties:false,required:['eventIds'],properties:{eventIds:{type:'array',minItems:1,maxItems:50,uniqueItems:true,items:uuid}}}},
];
export function validateMuseChanges(operation,p){
 if(!MUSE_CHANGE_TOOLS.some(t=>t.operation===operation))return false;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Change feed object required');
 if(operation==='changes.read'){if(Object.keys(p).some(k=>k!=='limit')||p.limit!==undefined&&(!Number.isInteger(p.limit)||p.limit<1||p.limit>50))throw Error('Choose limit 1–50');}
 else if(Object.keys(p).some(k=>k!=='eventIds')||!Array.isArray(p.eventIds)||!p.eventIds.length||p.eventIds.length>50||new Set(p.eventIds).size!==p.eventIds.length||p.eventIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))throw Error('Choose 1–50 unique change event IDs');
 return true;
}
