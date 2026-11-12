import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {createTestDatabase} from './helpers/database.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {circleThemes,circleTheme,validateCircleAvatar} from '../lib/circle-appearance.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const owner='11111111-1111-1111-1111-111111111111',peer='22222222-2222-2222-2222-222222222222';
const builtin={kind:'builtin',id:'todd'};
function png(width,height){
 function chunk(type,data){const body=Buffer.concat([Buffer.from(type),data]),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);let crc=0xffffffff;for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,body,checksum]);}
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc(height*(width*4+1));for(let row=0;row<height;row++)for(let column=0;column<width;column++)if(column%192>40&&column%192<150&&row%208>40&&row%208<170){const offset=row*(width*4+1)+1+column*4;pixels[offset]=130;pixels[offset+1]=100;pixels[offset+2]=210;pixels[offset+3]=255;}
 return `data:image/png;base64,${Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64')}`;
}
test('avatar and reviewed room contracts reject executable or malformed inputs',()=>{
 validateCircleAvatar(builtin);validateCircleAvatar({kind:'image',dataUrl:png(64,64)});validateCircleAvatar({kind:'sheet',dataUrl:png(768,624)});
 for(const avatar of [{kind:'builtin',id:'unknown'},{...builtin,script:'evil'},{kind:'image',dataUrl:'https://example.com/avatar.svg'},{kind:'image',dataUrl:png(513,64)},{kind:'sheet',dataUrl:png(768,623)}])assert.throws(()=>validateCircleAvatar(avatar));
 assert.equal(circleTheme('missing').id,'cloud-cottage');
 for(const theme of circleThemes){assert.match(theme.background,/^\/circles\/[a-z-]+\.webp$/);assert.equal(theme.positions.length,5);for(const position of theme.positions)for(const point of Object.values(position)){assert(point.x>=0&&point.x<=100);assert(point.y>=0&&point.y<=100);}}
 assert.throws(()=>validateRequest({operation:'circles.avatar',payload:{circleId:owner,expectedRevision:0,avatar:builtin,eventKey:'agent'}}));
});
test('appearance uses human ownership, membership, revisions and idempotent writes',async()=>{
 const db=await createTestDatabase();let sequence=0;
 async function human(actor,operation,payload={}){await db.query("select set_config('test.uid',$1,false)",[actor]);await db.exec('set role authenticated');try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[operation,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}}
 const write=(actor,operation,payload)=>human(actor,operation,{eventKey:`appearance-${++sequence}`,...payload});
 try{
  const {circleId}=await write(owner,'circles.create',{name:'Appearance test',alias:'Owner'});
  const invite=await write(owner,'circles.invite',{circleId});await write(peer,'circles.join',{token:invite.token,alias:'Peer'});
  const initial=await human(peer,'circles.read',{circleId});assert.equal(initial.appearance.revision,0);assert.equal(initial.members.find(member=>member.self).avatarRevision,0);
  const payload={circleId,expectedRevision:0,avatar:builtin,eventKey:'stable-avatar'};
  assert.deepEqual(await human(peer,'circles.avatar',payload),{revision:1});assert.deepEqual(await human(peer,'circles.avatar',payload),{revision:1});
  await assert.rejects(()=>human(peer,'circles.avatar',{...payload,avatar:{kind:'builtin',id:'jojo'}}),/Idempotency key changed/);
  await assert.rejects(()=>write(peer,'circles.avatar',{circleId,expectedRevision:0,avatar:builtin}),/Avatar changed/);
  await assert.rejects(()=>write(peer,'circles.theme',{circleId,expectedRevision:0,themeId:'lamplit-cottage'}),/owner required/);
  await write(owner,'circles.theme',{circleId,expectedRevision:0,themeId:'lamplit-cottage'});
  await assert.rejects(()=>write(owner,'circles.theme',{circleId,expectedRevision:0,themeId:'cloud-cottage'}),/Theme changed/);
  await assert.rejects(()=>write(owner,'circles.theme',{circleId,expectedRevision:1,themeId:'external-pack'}),/reviewed theme/);
  const current=await human(owner,'circles.read',{circleId});assert.equal(current.appearance.themeId,'lamplit-cottage');assert.deepEqual(current.members.find(member=>member.id===peer).avatar,builtin);
  const other=await write(peer,'circles.create',{name:'Second Circle',alias:'Peer'});assert.deepEqual((await human(peer,'circles.read',{circleId:other.circleId})).members[0].avatar,builtin);
  for(const avatar of [{kind:'sheet',dataUrl:png(768,623)},{kind:'image',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='},{...builtin,extra:true}])await assert.rejects(()=>write(peer,'circles.avatar',{circleId,expectedRevision:1,avatar}),/Invalid|PNG/);
  await write(peer,'circles.avatar',{circleId,expectedRevision:1,avatar:{kind:'sheet',dataUrl:png(768,624)}});
  const connection=(await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Appearance reader',$2,$3,now()+interval '1 day') returning id",[peer,'f'.repeat(64),['knowledge:read','knowledge:write']])).rows[0].id;
  await assert.rejects(()=>db.query('select private.knowledge_action($1,$2,$3::jsonb,$4)',[peer,'circles.avatar',JSON.stringify({circleId,expectedRevision:2,avatar:builtin,eventKey:'no-agent'}),connection]),/Human appearance selection required/);
  const agentRead=(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',['f'.repeat(64),'circles.read',JSON.stringify({circleId})])).rows[0].result;assert.equal(agentRead.members.find(member=>member.self).avatar.kind,'sheet');
  const handoff=(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',['f'.repeat(64),'knowledge.handoff',JSON.stringify({circleId,action:'manage'})])).rows[0].result;assert.equal(handoff.humanActionRequired,true);
  await write(owner,'circles.remove',{circleId,memberId:peer});await assert.rejects(()=>human(peer,'circles.read',{circleId}),/unavailable/);await assert.rejects(()=>human(peer,'circles.avatar',payload),/unavailable/);
  await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from private.circle_avatars'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
test('fictional appearance saves preview independently and reset cleanly',async()=>{
 const demo=createCircleKnowledgeDemo(),{circles}=await demo.action('circles.list'),circleId=circles[0].id;
 const payload={circleId,expectedRevision:0,avatar:builtin,eventKey:'avatar'};
 await demo.action('circles.avatar',payload);await demo.action('circles.avatar',payload);
 await demo.action('circles.theme',{circleId,expectedRevision:0,themeId:'lamplit-cottage',eventKey:'theme'});
 const detail=await demo.action('circles.read',{circleId});assert.equal(detail.appearance.themeId,'lamplit-cottage');assert.deepEqual(detail.members.find(member=>member.self).avatar,builtin);
 assert.throws(()=>demo.action('circles.avatar',{...payload,eventKey:'stale'}),/changed/);
 const reset=await createCircleKnowledgeDemo().action('circles.read',{circleId});assert.equal(reset.appearance.revision,0);assert.equal(reset.members.find(member=>member.self).avatarRevision,0);
});
