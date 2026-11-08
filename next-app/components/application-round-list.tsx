import {applicationRounds} from '../../lib/application-rounds.mjs';
import type {Application} from './workflow-types';
export default function ApplicationRoundList({application}:{application:Application}){
 const rounds=applicationRounds(application);
 return <section className="mb-5" aria-label="Saved application rounds"><h3 className="font-semibold">Rounds</h3>{rounds.length?<ol className="divide-y divide-board-line">{rounds.map((round:any)=><li key={round.id} className="py-3"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><strong>{round.label}</strong><span className="text-board-muted">{round.stage==='SCREEN'?'Screen':'Interview'} · {round.status}</span>{round.date&&<time dateTime={round.date}>{new Date(round.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',...(round.date.length===10?{timeZone:'UTC'}:{})})}</time>}</div>{round.notes&&<details className="mt-1 text-sm text-board-muted"><summary className="min-h-11 cursor-pointer py-2">Notes</summary><p className="whitespace-pre-wrap">{round.notes}</p></details>}</li>)}</ol>:<p className="mt-2 text-sm text-board-muted">No rounds recorded.</p>}</section>;
}
