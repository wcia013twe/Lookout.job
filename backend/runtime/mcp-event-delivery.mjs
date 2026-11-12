// Realtime only wakes this existing API process; it never carries signing keys.
// Reconnect/startup drains the durable outbox; timers exist only for pending work.
export function startEventDelivery({client,events,signal,log=console.warn}) {
  let timer,running=false,again=false,failures=0;
  const wake=()=>{
    if(signal.aborted)return;
    if(running){again=true;return;}
    clearTimeout(timer);running=true;
    events.deliver().then(next=>{
      failures=0;
      if(next&&!signal.aborted)timer=setTimeout(wake,Math.max(50,Date.parse(next)-Date.now()));
    }).catch(()=>{log('MCP event delivery unavailable; retained in durable outbox.');
      // Retry outages finitely; further recovery occurs on reconnect or new work.
      if(++failures<=6&&!signal.aborted)timer=setTimeout(wake,Math.min(300000,1000*2**failures));
    }).finally(()=>{running=false;if(again){again=false;wake();}});
  };
  const channel=client.channel('lookout-mcp-events').on('postgres_changes',
    {event:'*',schema:'public',table:'workspace_changes'},()=>wake())
    .subscribe(status=>{if(status==='SUBSCRIBED')wake();});
  signal.addEventListener('abort',()=>{clearTimeout(timer);void client.removeChannel(channel);},{once:true});
  wake();return wake;
}
