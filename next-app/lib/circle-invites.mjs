export function activeCircleInvites(invites,now=Date.now()) {
 return invites.filter(invite=>!invite.revoked_at&&Date.parse(invite.expires_at)>now);
}
// Coalesce rapid clicks before React's disabled state has rendered.
export function createCircleInviteOnce() {
 let pending=null;
 return function create(invites,run,now=Date.now()) {
  if(activeCircleInvites(invites,now).length)return Promise.resolve();
  if(pending)return pending;
  pending=Promise.resolve().then(run).finally(()=>{pending=null;});
  return pending;
 };
}
