export function validateCircleFeedPayload(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(key=>!['circleId','after','limit'].includes(key))||typeof payload.circleId!=='string'||!payload.circleId)throw Error('Invalid feed arguments.');
 if(payload.limit!==undefined&&(!Number.isInteger(payload.limit)||payload.limit<1||payload.limit>50))throw Error('Feed limit must be 1 to 50.');
 if(payload.after!==undefined){
  const cursor=payload.after;
  if(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||Object.keys(cursor).some(key=>!['version','circleId','position','through'].includes(key))||cursor.version!==1||cursor.circleId!==payload.circleId||typeof cursor.position!=='string'||!/^\d{1,18}$/.test(cursor.position)||cursor.through!==undefined&&(typeof cursor.through!=='string'||!/^\d{1,18}$/.test(cursor.through)||BigInt(cursor.position)>BigInt(cursor.through)))throw Error('Invalid or mismatched feed cursor.');
 }
}

// A later event invalidates older cached bodies; a thread invalidation also
// removes its replies. This is a display projection, never an access check.
export function visibleCircleFeedEvents(events) {
 const ordered=[...new Map(events.map(event=>[event.id,event])).values()].sort((a,b)=>BigInt(a.position)<BigInt(b.position)?-1:1);
 const latest=new Map(),invalidThreads=new Set();
 for(const event of ordered){latest.set(event.postId,event);if(event.invalidateThread)invalidThreads.add(event.threadId);}
 return [...latest.values()].reverse().map(event=>invalidThreads.has(event.threadId)?{...event,sourceAvailable:false,post:null}:event);
}
