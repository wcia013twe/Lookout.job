'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Field,control,primary,secondary} from '../../../components/ui';
import {activeCircleInvites,createCircleInviteOnce} from '../../../lib/circle-invites.mjs';
import type {Detail} from '../_lib/types';
type Props={detail:Detail;busy:boolean;act:(operation:string,payload:Record<string,unknown>)=>Promise<void>;embedded?:boolean};
export default function Settings({detail,busy,act,embedded=false}:Props){
 const {circle,members,invites,reports}=detail;
 const [createOnce]=useState(createCircleInviteOnce),[creating,setCreating]=useState(false);
 const hasInvite=activeCircleInvites(invites).length>0;
 async function createInvite(){if(busy||hasInvite)return;setCreating(true);try{await createOnce(invites,()=>act('circles.invite',{}));}finally{setCreating(false);}}
 const content=<div className="space-y-8 py-5">
  <Link className="inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" href={`/profile/?section=agent&circle=${encodeURIComponent(circle.id)}`}>My agent sharing settings</Link>
  <section><h2 className="text-lg font-bold">Circle members</h2><ul className="mt-3 divide-y divide-board-line">{members.map(member=><li key={member.id} className="flex min-h-14 items-center justify-between gap-4 py-2"><span className="break-words text-sm">{member.alias}</span>{circle.owner&&!member.owner&&<button className={secondary} disabled={busy} onClick={()=>void act('circles.remove',{memberId:member.id})}>Remove</button>}</li>)}</ul>{!circle.owner&&<><p className="mt-3 text-sm text-board-muted">Leaving stops access. Previously published contributions remain in the Circle.</p><button className={`${secondary} mt-4`} disabled={busy} onClick={()=>void act('circles.leave',{})}>Leave Circle</button></>}
   {circle.owner&&<><button type="button" className={`${primary} mt-4`} disabled={busy||creating||hasInvite} onClick={()=>void createInvite()}>{creating?'Creating invite…':hasInvite?'Invite ready to share':'Create a 7-day invite'}</button>{hasInvite&&<p className="mt-3 text-sm leading-relaxed text-board-muted">Use an existing invite below. Revoke active invites before creating another.</p>}<p className="my-3 text-sm text-board-muted">Share an invite code privately. Anyone with an active code can join. Removed members need an invite created after their removal.</p><ul className="space-y-4">{invites.map(invite=><li key={invite.id} className="space-y-2"><Field label={`Invite code · expires ${invite.expires_at.slice(0,10)}`}><input readOnly className={control} value={invite.token} onFocus={e=>e.target.select()}/></Field><button className={secondary} disabled={busy} onClick={()=>void act('circles.revoke_invite',{inviteId:invite.id})}>Revoke invite</button></li>)}</ul></>}
  </section>
  {circle.owner&&reports.length>0&&<section className="lg:col-span-2"><h2 className="text-lg font-bold">Reported contributions</h2><ul className="mt-3 divide-y divide-board-line">{reports.map(report=><li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="max-w-prose break-words text-sm">{report.reason}</p><Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={`/circles/?circle=${circle.id}&thread=${report.postId}`}>Review contribution</Link></div><button className={secondary} disabled={busy} onClick={()=>void act('knowledge.hide',{postId:report.postId})}>Hide reported contribution</button></li>)}</ul></section>}
 </div>;
 return embedded?content:<details className="mt-6 border-y border-board-line py-4"><summary className="min-h-11 py-2 font-semibold">Circle settings</summary>{content}</details>;
}
