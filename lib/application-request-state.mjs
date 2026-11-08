// Agent work and employer submission are separate facts.
export function applicationRequestLabel(job){
 if(!job)return '';
 if(job.result?.executor==='muse')return ({working:'Muse is working',prepared:'Ready for review',completed:'Muse reported completion',blocked:'Muse needs your input',uncertain:'Verify the submission outcome'})[job.result.outcome]||'Review Muse’s outcome';
 return ({queued:'Waiting for Muse',running:'Application work in progress',cancelled:'Application request cancelled',failed:'Application request failed',partial:'Application needs review',completed:'Review the saved outcome'})[job.status]||'Application requested';
}
