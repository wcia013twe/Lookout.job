import type {Rpc} from './types.ts';

export function createMaintenance({rpc,wakeWorker,deliver}:{rpc:Rpc;wakeWorker:()=>Promise<void>;deliver:()=>Promise<unknown>}){
 return async()=>{
  const {data,error}=await rpc('backend_worker_pending',{});
  if(error||typeof data!=='boolean')throw Error('Queue recovery unavailable');
  const settled=await Promise.allSettled([data?wakeWorker():Promise.resolve(),deliver()]);
  if(settled.some(result=>result.status==='rejected'))throw Error('Maintenance work incomplete');
  return {workerRequested:data};
 };
}
