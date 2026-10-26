import {validateBackendJob} from './backend-jobs.mjs';
const copy=value=>structuredClone(value);
const owner='11111111-1111-4111-8111-111111111111';
const connection='22222222-2222-4222-8222-222222222222';
export const DEMO_BACKEND_CONNECTION_ID=connection;
const fixtureId=index=>'33333333-3333-4333-8333-'+String(index).padStart(12,'0');
const fail=(message,code='40001')=>Object.assign(Error(message),{code});
export function backendJobsDemoFixtures() {
  const created='2026-10-26T12:00:00.000Z';
  return {
    fictional:true,
    jobs:['queued','running','completed','partial','failed','cancelled'].map((status,index)=>({
      id:fixtureId(index+1),user_id:owner,connection_id:connection,kind:'search_ats',input:{profileId:'general'},status,version:1,
      created_at:created,updated_at:created,
      result:['completed','partial'].includes(status)?{fictional:true,pipelineVersion:1,observed:3,verified:2,shortlist:{retainedListingIds:[fixtureId(100)],duplicateListingIds:[],screenedCount:2,excludedCount:1,evaluatedProfileVersion:1,personalVersion:1,applicantEligibility:'not-evaluated',reporting:'pending-muse'},stages:{collection:'finished',verification:'finished',screening:'finished',deduplication:'finished'},diagnostics:['Fictional ATS search result; no network request was made.']}:status==='failed'?{error:'Fictional source unavailable (demo).'}:null,
    })),
    schedules:[{id:fixtureId(10),user_id:owner,connection_id:connection,kind:'search_ats',input:{profileId:'general'},interval_minutes:1440,enabled:false,version:1,created_at:created,updated_at:created}],
  };
}
// Independent memory only: no backend client, storage, file bytes, timers, worker
// execution or network. Rebuilding the detached demo recreates these fixtures.
export function createBackendJobsDemo() {
  let state=backendJobsDemoFixtures(),sequence=20;
  const receipts=new Map();
  const replay=(operation,payload,perform)=>{
    const key=operation+':'+payload.eventKey;
    const signature=JSON.stringify(payload);
    const receipt=receipts.get(key);
    if(receipt) {
      if(receipt.signature!==signature)throw fail('Demo retry key belongs to another request','22023');
      return copy(receipt.result);
    }
    const result=perform();receipts.set(key,{signature,result:copy(result)});return copy(result);
  };
  return {
    fictional:true,
    reset(){state=backendJobsDemoFixtures();sequence=20;receipts.clear();},
    async read(payload={}) {
      validateBackendJob('backend.jobs.read',payload);
      const jobs=payload.jobId?state.jobs.filter(job=>job.id===payload.jobId):state.jobs;
      return {jobs:copy(jobs)};
    },
    async readSchedules(){return {schedules:copy(state.schedules)};},
    async submit(payload) {
      validateBackendJob('backend.jobs.submit',payload,{allowHumanConnection:true});
      if(payload.connectionId!==connection)throw fail('Fictional demo connection required','42501');
      return replay('submit',payload,()=>{
        const row={id:fixtureId(sequence++),user_id:owner,connection_id:connection,kind:payload.kind,input:copy(payload.input),status:'queued',version:1,result:null,error:null};
        state.jobs.unshift(row);return row;
      });
    },
    async cancel(payload) {
      validateBackendJob('backend.jobs.cancel',payload);
      const row=state.jobs.find(job=>job.id===payload.jobId);
      if(!row)throw fail('Fictional demo job not found','P0002');
      if(row.version!==payload.expectedVersion)throw fail('Demo job changed; reload before cancelling');
      if(!['queued','running'].includes(row.status))throw fail('Demo job already finished');
      row.status='cancelled';row.version++;return copy(row);
    },
    async saveSchedule(payload) {
      validateBackendJob('backend.schedules.save',payload,{allowHumanConnection:true});
      if(payload.connectionId!==connection)throw fail('Fictional demo connection required','42501');
      return replay('schedule',payload,()=>{
        let row=payload.id&&state.schedules.find(schedule=>schedule.id===payload.id);
        if(payload.id&&!row)throw fail('Fictional demo schedule not found','P0002');
        if(row&&row.version!==payload.expectedVersion)throw fail('Demo schedule changed; reload before saving');
        if(!row){row={id:fixtureId(sequence++),user_id:owner,connection_id:connection,version:0};state.schedules.unshift(row);}
        Object.assign(row,{kind:payload.kind,input:copy(payload.input),interval_minutes:payload.intervalMinutes,enabled:payload.enabled,version:row.version+1});
        return row;
      });
    },
  };
}
