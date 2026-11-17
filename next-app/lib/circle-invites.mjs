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

const pendingKey='lookout:pending-circle-invite';
export function circleInviteFromHash(hash) {
 const token=new URLSearchParams(hash.replace(/^#/, '')).get('invite');
 return token&&token.length<=100?token:'';
}
export function circleInviteLink(origin,path,token) {
 const url=new URL(path,origin);url.hash=new URLSearchParams({invite:token}).toString();return url.href;
}
export function rememberCircleInvite(storage,hash) {
 const token=circleInviteFromHash(hash);if(token)storage.setItem(pendingKey,token);return !!token;
}
export function hasPendingCircleInvite(storage) {return !!storage.getItem(pendingKey);}
export function takeCircleInvite(storage,hash) {
 const token=circleInviteFromHash(hash)||storage?.getItem(pendingKey)||'';
 storage?.removeItem(pendingKey);return token.length<=100?token:'';
}
