import {validateAutomationSchedule,validateCardPacks} from './card-packs.mjs';
import {readDailySchedule} from './daily-schedule.mjs';

export const PACK_DISCOVERY_PROMPT = 'Find new jobs that match my active search profile, preferences and résumé. Use the selected sources, verify each opening on the employer or ATS page, and deduplicate canonical application links. Explain the fit, cite matching profile evidence and flag one material gap; do not invent experience or posting dates. Publish suitable discoveries into this card pack, with notes for uncertain or skipped roles. Do not submit applications or send outreach.';

/** @param {{packId:string,title:string,sources?:Array<{id:string}>,connections?:Array<{id:string,scopes:string[],expires_at:string,revoked_at?:string|null}>,now?:number}} options */
export function createPackTask({packId,title,sources=[],connections=[],now=Date.now()}) {
  return {
    id:`pack-${packId}`,title:`${title} discovery`,description:PACK_DISCOVERY_PROMPT,
    enabled:true,mode:'scheduled',time:'09:00',
    sourceIds:[...new Set(sources.map(s=>s.id))].slice(0,8),
    connectionIds:[...new Set(connections.filter(c=>!c.revoked_at&&Date.parse(c.expires_at)>now&&c.scopes.includes('batches:write')).map(c=>c.id))].slice(0,4),
  };
}

const sameTask=(a,b)=>['id','title','description','enabled','mode','time'].every(k=>a[k]===b[k])
  && ['sourceIds','connectionIds'].every(k=>JSON.stringify(a[k]||[])===JSON.stringify(b[k]||[]));
const samePack=(a,b)=>a&&['id','title','enabled','taskId'].every(k=>a[k]===b[k])&&(a.archive||'none')===(b.archive||'none');

// Compose the existing scoped actions; each action keeps its own backend CAS.
// Stable IDs let retries reconcile a saved task after an interrupted response.
/** @param {{readSettings:()=>Promise<any>,performAction:(operation:string,payload:any)=>Promise<any>,pack:any,task:any,expectedPackVersion:number,timezone?:string,onTaskSaved?:(schedule:any,updatedAt:string|null)=>void}} options */
export async function savePackWithTask({readSettings,performAction,pack,task,expectedPackVersion,timezone='UTC',onTaskSaved=()=>{}}) {
  validateCardPacks([pack]);
  if(pack.taskId!==task.id)throw Error('The pack must link to its new task.');
  let current=await readSettings();
  const existing=current.schedule?.routines.find(t=>t.id===task.id);
  if(existing&&!sameTask(existing,task))throw Error('This task changed. Review it in Search before linking the pack.');
  if(samePack(current.theme.cardPacks?.find(p=>p.id===pack.id),pack)&&existing) {
    onTaskSaved(current.schedule,current.updatedAt);
    return {theme:current.theme,updated_at:current.updatedAt};
  }
  function checkPackVersion() {
    if((current.theme.cardPacksVersion||0)!==expectedPackVersion)throw Error('Pack settings changed. Reload the saved setup before retrying.');
  }
  checkPackVersion();
  // Check pack capacity before creating its task.
  validateCardPacks([...(current.theme.cardPacks||[]).filter(p=>p.id!==pack.id),pack]);
  if(!existing) {
    const previous=readDailySchedule(current.schedule,timezone);
    const schedule={...previous,
      routines:[...previous.routines,task],
      configVersion:(current.schedule?.configVersion||0)+1};
    validateAutomationSchedule(schedule);
    const saved=await performAction('preferences.notifications.save',{settings:{schedule},expectedUpdatedAt:current.updatedAt});
    onTaskSaved(saved.search.schedule,saved.updated_at);
  } else onTaskSaved(current.schedule,current.updatedAt);
  current=await readSettings();
  checkPackVersion();
  const theme={...current.theme,cardPacks:[...(current.theme.cardPacks||[]).filter(p=>p.id!==pack.id),pack],cardPacksVersion:expectedPackVersion+1};
  validateCardPacks(theme.cardPacks);
  return performAction('preferences.theme.save',{theme,expectedUpdatedAt:current.updatedAt});
}
