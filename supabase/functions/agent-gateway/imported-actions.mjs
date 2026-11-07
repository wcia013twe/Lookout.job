export const IMPORT_PROGRESS_STAGES=['SAVED','APPLIED','SCREEN','INTERVIEW','OFFER'];
export const IMPORT_ACTION_FIELDS=['nextAction','actionDate','needsAction','completedStages'];
export function validateImportedActions(record,{partial=false}={}) {
 if(Object.hasOwn(record,'nextAction')&&record.nextAction!==null&&(typeof record.nextAction!=='string'||record.nextAction.length>300))throw Error('Next action must be text up to 300 characters, or null.');
 if(Object.hasOwn(record,'actionDate')&&record.actionDate!==null){
  const date=record.actionDate;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Action date must be YYYY-MM-DD or null.');
 }
 if(Object.hasOwn(record,'needsAction')&&typeof record.needsAction!=='boolean')throw Error('Needs action must be true or false.');
 if(Object.hasOwn(record,'completedStages')&&(!Array.isArray(record.completedStages)||record.completedStages.length>5||new Set(record.completedStages).size!==record.completedStages.length||record.completedStages.some(stage=>!IMPORT_PROGRESS_STAGES.includes(stage))))throw Error('Choose unique completed tracker stages.');
 if(!partial){
  if((record.actionDate||record.needsAction)&&!record.nextAction?.trim())throw Error('Name the next action before setting its date or Needs action.');
  const current=IMPORT_PROGRESS_STAGES.indexOf(record.status);
  if(current>=0&&record.completedStages?.some(stage=>IMPORT_PROGRESS_STAGES.indexOf(stage)>current))throw Error('A completed stage cannot be ahead of the current stage.');
 }
}
