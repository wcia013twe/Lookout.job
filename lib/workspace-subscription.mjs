// Notifications invalidate snapshots; saved state is always read through RLS.
// Subscribe first, then reconcile on every connection/reconnection to catch gaps.
export function subscribeWorkspaceChanges(client, owner, refresh, unavailable = () => {}) {
 let active=true;
 const changed=()=>{if(active)refresh();};
 const channel=client.channel(`workspace:${owner}`)
  .on('postgres_changes',{event:'*',schema:'public',table:'workspace_changes',filter:`user_id=eq.${owner}`},changed)
  .subscribe(status=>{
   if(!active)return;
   if(status==='SUBSCRIBED')changed();
   else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))unavailable();
  });
 return ()=>{active=false;void client.removeChannel(channel);};
}
