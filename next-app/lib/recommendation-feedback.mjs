export const emptyFeedback = Object.freeze({rating:null,reason:'',note:'',version:0,status:'loading',error:''});

export function feedbackTargetAvailable({demo,roles=[]},{kind='job',targetId}) {
  return demo || kind!=='job' || roles.some(role=>role.id===targetId);
}

export function createFeedbackCache(services, {current=()=>true}={}) {
  const rows=new Map(), listeners=new Map(), pending=new Map(), revisions=new Map();
  let scheduled=false;
  const keyOf=target=>JSON.stringify([target.kind,target.targetId]);
  function emit(key,value) { rows.set(key,value); listeners.get(key)?.forEach(listener=>listener()); }
  async function flush() {
    scheduled=false;
    const targets=[...pending.values()]; pending.clear();
    for(let offset=0;offset<targets.length;offset+=50) {
      const batch=targets.slice(offset,offset+50);
      try {
        const result=await services.readRecommendationFeedback({targets:batch.map(({kind,targetId})=>({kind,targetId}))});
        if(!current()){
          for(const target of batch)emit(keyOf(target),{...(rows.get(keyOf(target))||emptyFeedback),status:'error',error:'Account changed. Reload saved feedback to continue.'});
          return;
        }
        if(!Array.isArray(result.rows))throw new Error('Invalid feedback response');
        for(const target of batch) {
          if(revisions.get(keyOf(target))!==target.revision)continue;
          const saved=result.rows.find(row=>row.kind===target.kind&&row.targetId===target.targetId);
          emit(keyOf(target),{...emptyFeedback,...saved,status:'ready',error:''});
        }
      } catch {
        for(const target of batch)if(revisions.get(keyOf(target))===target.revision)emit(keyOf(target),{...(rows.get(keyOf(target))||emptyFeedback),status:'error',error:'Feedback could not load. Retry before editing.'});
      }
    }
  }
  function load(target) {
    const key=keyOf(target);
    emit(key,{...(rows.get(key)||emptyFeedback),status:'loading',error:''});
    const revision=(revisions.get(key)||0)+1; revisions.set(key,revision);
    pending.set(key,{...target,revision});
    if(!scheduled){scheduled=true;queueMicrotask(flush);}
  }
  return {
    get:target=>rows.get(keyOf(target))||emptyFeedback,
    subscribe(target,listener) {
      const key=keyOf(target);
      if(!listeners.has(key))listeners.set(key,new Set());
      listeners.get(key).add(listener);
      if(!rows.has(key))load(target);
      return ()=>listeners.get(key)?.delete(listener);
    },
    load,
    async save(target,change,context,requestId) {
      const key=keyOf(target), previous=rows.get(key)||emptyFeedback;
      if(!current()||previous.status!=='ready')return false;
      emit(key,{...previous,status:'saving',error:''});
      try {
        const saved=await services.saveRecommendationFeedback({...target,...change,expectedVersion:previous.version,requestId,context});
        if(!current()){
          emit(key,{...previous,status:'error',error:'Account changed. Reload saved feedback to reconcile the save.'});
          return false;
        }
        if(!saved||!Number.isInteger(saved.version))throw new Error('Invalid feedback response');
        emit(key,{...emptyFeedback,...saved,status:'ready',error:''});
        return true;
      } catch {
        emit(key,{...previous,status:'error',error:'Feedback was not confirmed. Reload saved feedback before trying again; your note is kept.'});
        return false;
      }
    },
  };
}
