import {trackerProgress} from './tracker-display.mjs';
import {isObservedConfirmation} from './submission-record.mjs';
// Agent work and employer submission are separate facts.
export function applicationRequestLabel(job){
 if(!job)return '';
 if(job.result?.executor==='muse')return ({working:'Muse is working',prepared:'Ready for review',completed:'Muse reported completion',blocked:'Muse needs your input',uncertain:'Verify the submission outcome'})[job.result.outcome]||'Review Muse’s outcome';
 return ({queued:'Waiting for Muse',running:'Application work in progress',cancelled:'Application request cancelled',failed:'Application request failed',partial:'Application needs review',completed:'Review the saved outcome'})[job.status]||'Application requested';
}

// A preparation job is historical once later application progress is recorded.
// Keep real uncertainty visible until an observed outcome resolves it.
export function applicationWorkLabel(application,trackerItem={}) {
 const job=application?.executionJob;if(!job)return '';
 const progress=trackerProgress(application,trackerItem);
 const uncertain=job.result?.outcome==='uncertain'||job.result?.blocker?.submissionState==='uncertain';
 if(uncertain&&!isObservedConfirmation(application.receipt))return applicationRequestLabel(job);
 if(progress.level>=1||['Rejected','Withdrawn','Closed'].includes(progress.status))return '';
 return applicationRequestLabel(job);
}
