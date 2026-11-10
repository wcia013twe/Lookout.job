// Preserve raw observations while withholding invalid execution performance.
export function timingSummary(run){
 const stages=run.stages||[],startups=run.startups||[];
 const executionValid=stages.length>0&&stages.every(s=>s.timing?.valid===true&&Number.isFinite(s.executionSeconds)&&s.executionSeconds>=0);
 const startupValid=startups.length>0&&startups.every(s=>s.timing?.valid===true&&Number.isFinite(s.durationSeconds)&&s.durationSeconds>=0);
 const activeSeconds=executionValid?stages.reduce((n,s)=>n+s.executionSeconds,0):null;
 const sessionStartupSeconds=startupValid?startups.reduce((n,s)=>n+s.durationSeconds,0):null;
 return {executionValid,startupValid,activeSeconds,sessionStartupSeconds,participantSecondsWithStartup:activeSeconds!==null&&sessionStartupSeconds!==null?activeSeconds+sessionStartupSeconds:null,rawStageWallSeconds:stages.every(s=>Number.isFinite(s.durationSeconds))?stages.reduce((n,s)=>n+s.durationSeconds,0):null};
}
