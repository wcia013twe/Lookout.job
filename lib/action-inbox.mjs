export function pendingActions(items = [], now = Date.now()) {
 return items.filter(item=>!item.resolved_at && Date.parse(item.available_at)<=now)
  .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
}
export function nextActionTime(items = [], now = Date.now()) {
 const future=items.filter(item=>!item.resolved_at).map(item=>Date.parse(item.available_at)).filter(at=>at>now);
 return future.length?Math.min(...future):null;
}

// Board flags read the same durable handoffs as the Action Board and MCP inbox.
export function applicationAction(application, items = [], now = Date.now()) {
 const imported=application?.imported?.record;
 if(imported)return !application.archived&&!['REJECTED','WITHDRAWN','CLOSED'].includes(imported.status)&&imported.needsAction===true&&imported.nextAction?.trim()?{reason:imported.nextAction,kind:'imported_action'}:null;
 if (!application?.backendId) return null;
 return pendingActions(items, now).find(item => item.application_id === application.backendId) || null;
}
