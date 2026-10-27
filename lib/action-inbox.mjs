export function pendingActions(items = [], now = Date.now()) {
 return items.filter(item=>!item.resolved_at && Date.parse(item.available_at)<=now)
  .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
}
export function nextActionTime(items = [], now = Date.now()) {
 const future=items.filter(item=>!item.resolved_at).map(item=>Date.parse(item.available_at)).filter(at=>at>now);
 return future.length?Math.min(...future):null;
}
