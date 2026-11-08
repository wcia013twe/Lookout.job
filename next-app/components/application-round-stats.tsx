import {applicationRoundStats} from '../../lib/application-rounds.mjs';
import type {Application} from './workflow-types';
export default function ApplicationRoundStats({applications}:{applications:Application[]}){
 const stats=applicationRoundStats(applications);
 return <section className="mt-6 border-t border-board-line pt-5" aria-labelledby="round-stats-title"><h3 id="round-stats-title" className="text-lg font-semibold">Rounds</h3><p className="mt-1 text-sm text-board-muted">{stats.total} rounds across {stats.applicationsWithRounds} {stats.applicationsWithRounds===1?'application':'applications'}</p>
 <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm tabular-nums"><caption className="sr-only">Saved round counts by stage and progress</caption><thead><tr>{['Stage','Pending','Scheduled','Completed','Cancelled'].map(label=><th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{(['SCREEN','INTERVIEW'] as const).map(stage=><tr key={stage} className="border-t border-board-line"><th scope="row" className="p-2 font-medium">{stage==='SCREEN'?'Screen':'Interview'}</th>{(['pending','scheduled','completed','cancelled'] as const).map(status=><td key={status} className="p-2">{stats.byStage[stage][status]}</td>)}</tr>)}</tbody></table></div>
 {!!stats.total&&<details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 text-board-muted">By round type</summary><ul className="grid gap-2 sm:grid-cols-2">{Object.entries(stats.byType).filter(([,count])=>(count as any).total>0).map(([type,count])=><li key={type} className="flex justify-between gap-3"><span>{type.replaceAll('_',' ')}</span><span className="tabular-nums">{(count as any).total}</span></li>)}</ul></details>}
 </section>;
}
