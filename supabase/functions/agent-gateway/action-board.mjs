export const ACTION_BOARD_TOOL = {
 name:'read_action_board',operation:'actions.board.read',scope:'workspace:read',readOnly:true,
 description:'Read deterministic owned human decisions, exact source keys, stopped applications and decision history. Follow each website link for human review. Agents cannot accept, reject, verify or resume work. A rejection stops work, not a request for revision. Approval is not submission; outreach ready is not sent.',
 inputSchema:{type:'object',additionalProperties:false,properties:{}}
};
export function validateActionBoard(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length)throw Error('Board read takes no arguments');
}

export const TRACKER_ACTION_PROGRESS_TOOL={
 name:'record_tracker_action_progress',operation:'actions.tracker.progress',scope:'tracking:write',requiredScopes:['workspace:read','activity:write'],
 description:'Record started/completed/blocked/uncertain for an exact human-approved tracker decision from read_action_board.trackerWork. Pass its key and current version with a UUID eventKey. Started claims one connection; only that connection may report an outcome. Completion requires a factual note and clears only the unchanged approved tracker task. Source changes/stops fence execution; already-started outcomes remain reportable without modifying a replacement task. Cannot approve, reject, resume, grant submission permission or create a verified submission receipt.',
 inputSchema:{type:'object',additionalProperties:false,required:['key','expectedVersion','stage','eventKey'],properties:{key:{type:'string',maxLength:400},expectedVersion:{type:'integer',minimum:1},stage:{type:'string',enum:['started','completed','blocked','uncertain']},note:{type:'string',maxLength:1000},eventKey:{type:'string',format:'uuid'}}}
};
export function validateTrackerProgress(p){
 const keys=TRACKER_ACTION_PROGRESS_TOOL.inputSchema.properties;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!Object.hasOwn(keys,k))||typeof p.key!=='string'||!p.key||p.key.length>400||!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<1||!['started','completed','blocked','uncertain'].includes(p.stage)||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.eventKey||'')||p.note!==undefined&&(typeof p.note!=='string'||p.note.length>1000)||p.stage!=='started'&&!p.note?.trim())throw Error('Exact tracker decision/version, progress stage, UUID eventKey and outcome note required');
}
