import {createBackend} from './backend/client.mjs';
import {fromCloud,draftPayload,batchRoles,uuid} from './cloud-model.mjs';
export function connectCloud(client) {
  const store=JB.store,button=document.querySelector('#account-save'),reload=document.querySelector('#account-load'),feedback=document.querySelector('#cloud-status');
  let loaded=null,account=null,generation=0,applying=false,loading=false,running=null,timer=null;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const snapshot=w=>JSON.stringify({...w,cloudDirty:false});
  async function checked(request){const {data,error}=await request;if(error)throw error;return data;}
  function controls(locked){
    ['profile','auto-tracker','needs-you'].forEach(id=>document.getElementById(id).inert=locked);
    reload.disabled=locked;document.querySelector('#approve-draft').disabled=locked;
  }
  function apply(w,refresh=false){applying=true;store.set('workflow',w);if(refresh)document.dispatchEvent(new CustomEvent('workspace:hydrated'));applying=false;}
  function schedule(){
    clearTimeout(timer);
    if(account && loaded && !loading)timer=setTimeout(()=>save().catch(()=>{}),650);
  }
  async function load(userId,replace=false){
    const token=++generation;account=userId;loaded=null;clearTimeout(timer);
    button.hidden=true;reload.hidden=!userId;feedback.textContent='';
    if(!userId){loading=false;controls(false);JB.setBatch?.(null);return;}
    loading=true;controls(true);feedback.textContent='Loading your account…';
    try{
      const api=createBackend(client,userId),rows=await api.loadWorkspace();
      if(token!==generation)return;
      loaded=rows;
      if(!store.get('workflow.cloudDirty') || replace)apply(fromCloud(rows),true);
      const id=new URL(location.href).searchParams.get('batch');
      if(id){
        if(!uuid(id))throw Error('Invalid batch link');
        const {batch,items}=await api.getBatch(id);await JB.catalogReady;
        if(token!==generation)return;
        JB.setBatch?.({roles:batchRoles(items,batch.batch_date),date:batch.batch_date,label:batch.label});
      }
      feedback.textContent='Account connected. Changes sync automatically.';
    }catch(error){if(token===generation){feedback.textContent='Account or batch could not load. Browser changes are retained.';button.hidden=false;}}
    finally{if(token===generation){loading=false;controls(false);if(store.get('workflow.cloudDirty'))schedule();}}
  }
  async function persist(){
    const userId=account,token=generation,w=store.get('workflow'),api=createBackend(client,userId),touched=new Map();
    if(!userId || !loaded || loading)throw Error('Account is not ready.');
    let upgraded=false;
    for(const r of w.resumes)if(!uuid(r.id)){const old=r.id;r.id=crypto.randomUUID();upgraded=true;Object.values(w.applications).forEach(a=>{if(a.resumeId===old)a.resumeId=r.id;});}
    if(upgraded){applying=true;store.set('workflow',w);applying=false;}
    const sent=snapshot(w),baseline=fromCloud(loaded);
    feedback.textContent='Syncing…';button.hidden=true;
    // Every SDK operation checks the expected owner; explicit inserts also use that owner for RLS.
    const assertAccount=()=>{if(token!==generation)throw Error('Account changed.');};
    function preserveEdits(){
      if(token!==generation)return;
      const latest=store.get('workflow');
      for(const [jobId,row] of touched){if(latest.applications[jobId]){latest.applications[jobId].backendId=row.id;latest.applications[jobId].backendRevision=row.revision;}}
      applying=true;store.set('workflow',latest);applying=false;
    }
    try{
      if(!same(w.profile,baseline.profile)){const facts={...w.profile};delete facts.verified;await api.saveProfile(facts,w.profile.verified);assertAccount();}
      if(!same(w.tierLists,baseline.tierLists) || w.activeTierListId!==baseline.activeTierListId){await api.savePreferences({search:loaded.preferences[0]?.search || {},theme:loaded.preferences[0]?.theme || {pack:'base'},tierLists:w.tierLists,activeTierListId:w.activeTierListId});assertAccount();}
      for(const r of w.resumes)if(!loaded.resumes.some(x=>x.id===r.id)){const row=await checked(client.from('resumes').insert({id:r.id,user_id:userId,name:r.name,reference_url:r.url || null,object_path:r.objectPath || null,version:r.version || 1}).select().single());assertAccount();loaded.resumes.push(row);}
      for(const a of w.savedAnswers)if(!same(a,baseline.savedAnswers.find(x=>x.id===a.id))){await api.saveAnswer({...a,verified:Boolean(a.verifiedAt),context:{version:a.version}});assertAccount();}
      for(const id of w.deletedAnswerIds || []){await api.deleteAnswer(id);assertAccount();}
      for(const app of Object.values(w.applications)){
        const previous=loaded.applications.find(a=>a.job_id===app.id),draft=draftPayload(app);
        if(previous){
          if(!same(previous.draft,draft) || (previous.blocker || '')!==(app.blocker || '')){
            if(app.backendRevision!==previous.revision)throw Error('Application changed. Reload and review.');
            const row=await api.saveDraft(previous.id,previous.revision,draft,app.blocker || null);assertAccount();touched.set(app.id,row);Object.assign(previous,row);
          }
        }else{const row=await checked(client.from('applications').insert({user_id:userId,job_id:app.id,draft,blocker:app.blocker || null}).select().single());assertAccount();loaded.applications.push(row);touched.set(app.id,row);}
      }
      const rows=await api.loadWorkspace();assertAccount();loaded=rows;
      if(snapshot(store.get('workflow'))===sent){apply(fromCloud(rows));feedback.textContent='Synced';}
      else{preserveEdits();const latest=store.get('workflow');latest.deletedAnswerIds=(latest.deletedAnswerIds || []).filter(id=>!(w.deletedAnswerIds || []).includes(id));applying=true;store.set('workflow',latest);applying=false;feedback.textContent='Syncing latest changes…';schedule();}
    }catch(error){preserveEdits();if(token===generation){feedback.textContent='Sync paused. Changes are kept in this browser. Retry, or load the account version if an application changed elsewhere.';button.hidden=false;}throw error;}
  }
  async function save(){
    clearTimeout(timer);
    if(running)await running;
    if(!store.get('workflow.cloudDirty'))return;
    running=persist();
    try{await running;}finally{running=null;}
  }
  async function approve(jobId){
    const token=generation,userId=account;controls(true);
    try{
      await save();if(token!==generation)throw Error('Account changed.');
      const app=loaded?.applications.find(a=>a.job_id===jobId);if(!app)throw Error('Application has not synced.');
      const api=createBackend(client,userId);await api.approve(app.id,app.revision);
      const rows=await api.loadWorkspace();if(token!==generation)throw Error('Account changed.');loaded=rows;apply(fromCloud(rows));feedback.textContent='Approved version synced. It has not been submitted.';
    }finally{if(token===generation)controls(false);}
  }
  button.addEventListener('click',()=>{if(!loaded)load(JB.auth.userId);else save().catch(()=>{});});
  reload.addEventListener('click',()=>{if(store.get('workflow.cloudDirty') && !confirm('Replace unsynced browser edits with the account version?'))return;load(account,true);});
  window.addEventListener('online',()=>{if(account && !loaded)load(account);else schedule();});
  store.subscribe('workflow',()=>{if(account && loaded && !applying){store.set('workflow.cloudDirty',true);feedback.textContent='Changes saved locally · syncing…';schedule();}});
  JB.cloud={save,approve,get ready(){return Boolean(account&&loaded);}};
  document.addEventListener('workspace:account',event=>{++generation;account=null;loaded=null;clearTimeout(timer);setTimeout(()=>load(event.detail.userId),0);});
  if(JB.auth.userId)setTimeout(()=>load(JB.auth.userId),0);
}
