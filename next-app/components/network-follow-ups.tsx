"use client";
import Link from 'next/link';
import {useNetworkCompanies} from '../lib/network';
import {useOutreach} from '../lib/outreach';
import {useWorkspace} from '../lib/workspace';
import {companyFollowUps} from '../../lib/network-model.mjs';
import {secondary} from './ui';
export default function NetworkFollowUps(){
 const outreach=useOutreach(),network=useNetworkCompanies(outreach),w=useWorkspace();
 const timezone=w.state.workflow.searchPreferences?.quietMode?.timezone||'UTC';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const due=companyFollowUps(network.rows,today);
 if(!due.length&&!network.error)return null;
 return <section className="mt-6 border-t border-board-line pt-5" aria-labelledby="network-follow-up-heading"><h2 id="network-follow-up-heading" className="text-lg font-semibold">Company follow-ups</h2>{network.error?<div><p className="mt-2 text-sm text-board-muted">Company follow-ups could not load.</p><button className={`${secondary} mt-3`} onClick={network.refresh}>Retry follow-ups</button></div>:<ul className="mt-3 divide-y divide-board-line">{due.map((row:{id:string;record:{name:string;nextAction:string;followUpDate:string}})=><li className="flex flex-wrap items-center justify-between gap-3 py-4" key={row.id}><div className="min-w-0"><p className="break-words font-semibold">{row.record.nextAction}</p><p className="mt-1 break-words text-sm text-board-muted">{row.record.name} · {row.record.followUpDate<today?'Overdue':'Due today'} · {row.record.followUpDate}</p></div><Link className={secondary} href={`/referrals/?company=${encodeURIComponent(row.id)}`}>Open company</Link></li>)}</ul>}</section>;
}
