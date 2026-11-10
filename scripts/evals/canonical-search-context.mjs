// Host-only new-owner fixture migration. Never repairs a completed participant owner.
import {isDeepStrictEqual} from 'node:util';
import {profileDocument,parseDocument} from '../../lib/search/documents.mjs';
const ok=r=>{if(r.error)throw Error('Canonical fixture operation failed: '+r.error.code);return r.data;};
const fields='user_id,kind,id,version,content,projection';
const order=rows=>[...rows].sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
export function canonicalProfileRows(settings,owner){
 if(!owner||settings.profile?.user_id!==owner||settings.preferences?.user_id!==owner)throw Error('New fixture owner mismatch');
 const profiles=settings.preferences?.search?.profiles||[];
 if(!Array.isArray(profiles)||new Set(profiles.map(p=>p.id)).size!==profiles.length)throw Error('Unique legacy profiles required');
 return profiles.map(p=>{
  if(Object.keys(p).some(k=>!['id','name','active','filters','priorities','instructions','prompt','version'].includes(k)))throw Error('Unsupported legacy profile field; explicit canonical source required');
  if(p.instructions!==undefined&&p.prompt!==undefined&&p.instructions!==p.prompt)throw Error('Conflicting legacy profile narratives');
  const version=p.version??1;if(!Number.isSafeInteger(version)||version<1)throw Error('Positive profile version required');
  const {content,projection}=parseDocument('profile',profileDocument({...p,instructions:p.instructions??p.prompt??''}));
  return {user_id:owner,kind:'profile',id:p.id,version,content,projection};
 });
}
export async function cloneCanonicalProfiles(db,settings,owner){
 const rows=canonicalProfileRows(settings,owner);
 const prior=ok(await db.from('search_documents').select(fields).eq('user_id',owner));
 if(prior.length)throw Error('Canonical fixture cloning requires a fresh empty owner');
 if(rows.length){ok(await db.from('search_documents').insert(rows));ok(await db.from('search_document_revisions').insert(rows));}
 const actual=ok(await db.from('search_documents').select(fields).eq('user_id',owner));
 const revisions=ok(await db.from('search_document_revisions').select(fields).eq('user_id',owner));
 if(!isDeepStrictEqual(order(actual),order(rows))||!isDeepStrictEqual(order(revisions),order(rows)))throw Error('Canonical fixture profile readback mismatch');
 return {status:'passed',profileCount:rows.length,revisionsVerified:true,source:'legacy_profile_migration_using_product_serializer',coverage:'profiles_only; no rules or portals invented'};
}
export function verifyCanonicalProfiles(settings,context){
 const owner=settings.profile?.user_id,rows=canonicalProfileRows(settings,owner);
 for(const row of rows){const actual=context.documents?.find(d=>d.kind==='profile'&&d.id===row.id);if(!actual||actual.version!==row.version||actual.content!==row.content||!isDeepStrictEqual(actual.projection,row.projection))throw Error('Native canonical profile context mismatch');}
 if(context.profiles?.length!==rows.length)throw Error('Native canonical profile list mismatch');
 return {status:'passed',profileCount:rows.length,nativeReadbackVerified:true};
}
