const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const sameCompanyRecord=(a,b)=>canonical(a)===canonical(b);
// Owner-scoped queue. Failed writes remain durable; conflicts never overwrite drafts.
export function createCompanySync({owner,read,write,get,set,isCurrent,onStatus=()=>{}}){
 let running=null;
 async function synchronize(){
  if(running)return running;
  running=(async()=>{
   const remote=await read();if(!isCurrent())return;
   const local=get();const combined=new Map(remote.map(row=>[row.id,row]));
   for(const row of local){
    const saved=combined.get(row.id);
    if(row.dirty||!saved){
     // A lost response can be recovered without submitting a second revision.
     if(saved&&saved.revision===row.revision+1&&sameCompanyRecord(saved.record,row.record)){combined.set(row.id,{...saved,dirty:false});continue;}
     if(row.dirty&&saved&&saved.revision!==row.revision){combined.set(row.id,{...row,conflict:true});continue;}
     combined.set(row.id,{...row,revision:saved?.revision??(row.legacyImport&&!row.dirty?0:row.revision),dirty:true});
    }
   }
   set([...combined.values()]);
   for(const row of [...combined.values()]){
    if(!isCurrent())return;
    if(!row.dirty||row.conflict)continue;
    try{
     const saved=await write(row);if(!isCurrent())return;
     set(get().map(current=>current.id!==row.id?current:sameCompanyRecord(current.record,row.record)?{...saved,dirty:false}:{...current,revision:saved.revision}));
    }catch(error){
     if(!isCurrent())return;
     if(error.code==='40001')set(get().map(current=>current.id===row.id?{...current,conflict:true}:current));
     throw error;
    }
   }
   onStatus(get().some(row=>row.conflict)?'Company changed in another session. Your draft is kept here; reload the saved company to resolve the conflict.':'');
  })();
  try{await running;}finally{running=null;}
 }
 return {owner,synchronize};
}
