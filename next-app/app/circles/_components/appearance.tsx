'use client';
import {useRef,useState,type CSSProperties} from 'react';
import {circleThemes,circleTheme,validateCircleAvatar} from '../../../../lib/circle-appearance.mjs';
import {companions} from './companions';
import {primary,secondary} from '../../../components/ui';
import type {Avatar,Detail,Request} from '../_lib/types';
import styles from './appearance.module.css';

const creatorPrompt='Create a Circle avatar of me or a character I describe. Return a transparent RGBA PNG, with no background, text, or shadows outside the character. Still image: at most 512 × 512 pixels. Optional animation: exactly 768 × 624 pixels, a 4-column × 3-row sheet of 192 × 208 cells. Rows: idle, walking, celebrating; four frames each. Keep feet and scale aligned, with transparent margins in every cell. Keep the file under 128 KB. For a room pack, use the downloadable JSON manifest: a 3:2 background, palette, five station/aisle/gathering positions and optional decorative art baked into the background. No executable code, CSS, HTML, external URLs, or changes to personal avatars. Room packs require maintainer review before appearing in the catalog.';

export function AvatarPreview({avatar,state='idle'}:{avatar:Avatar;state?:string}){
 const image=avatar.kind==='builtin'?`/circles/${avatar.id}.webp`:avatar.dataUrl;
 return <span className={styles.avatar} data-kind={avatar.kind} data-state={state} style={{'--avatar-image':`url("${image}")`} as CSSProperties} aria-hidden="true"/>;
}

async function readAvatar(file:File,kind:'image'|'sheet'):Promise<Avatar>{
 if(file.type!=='image/png'||file.size>131072)throw Error('Choose a transparent PNG up to 128 KB.');
 const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Could not read image.'));reader.readAsDataURL(file);});
 const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('This PNG could not be opened.'));image.src=dataUrl;});
 if(kind==='sheet'?(image.width!==768||image.height!==624):(image.width>512||image.height>512))throw Error(kind==='sheet'?'Animation must be 768 × 624 pixels.':'Still images must be at most 512 × 512 pixels.');
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d');if(!context)throw Error('Image preview unavailable.');context.drawImage(image,0,0);
 const pixels=context.getImageData(0,0,image.width,image.height).data;
 const cells=kind==='sheet'?12:1;
 for(let cell=0;cell<cells;cell++){
  const left=kind==='sheet'?(cell%4)*192:0,top=kind==='sheet'?Math.floor(cell/4)*208:0,width=kind==='sheet'?192:image.width,height=kind==='sheet'?208:image.height;
  let artwork=false,transparent=false;
  for(let row=top;row<top+height;row++)for(let column=left;column<left+width;column++){const alpha=pixels[(row*image.width+column)*4+3];artwork||=alpha>0;transparent||=alpha===0;}
  if(!artwork||!transparent)throw Error('Each frame needs visible artwork and a transparent background.');
 }
 const avatar={kind,dataUrl};validateCircleAvatar(avatar);return avatar;
}

export default function Appearance({detail,request,onSaved}:{detail:Detail;request:Request;onSaved:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),uploadVersion=useRef(0),pending=useRef<{operation:string;payload:Record<string,unknown>;eventKey:string}|null>(null);
 const self=detail.members.find(member=>member.self);
 const [avatar,setAvatar]=useState<Avatar>(self?.avatar||{kind:'builtin',id:'alfred'}),[themeId,setThemeId]=useState(detail.appearance?.themeId||'cloud-cottage');
 const [tab,setTab]=useState('avatar'),[state,setState]=useState('idle'),[uploadKind,setUploadKind]=useState<'image'|'sheet'>('image'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 function open(){setAvatar(self?.avatar||{kind:'builtin',id:'alfred'});setThemeId(detail.appearance?.themeId||'cloud-cottage');setError('');setNotice('');dialog.current?.showModal();}
 async function save(){
  if(busy)return;setBusy(true);setError('');setNotice('');
  const operation=tab==='avatar'?'circles.avatar':'circles.theme';
  const payload={circleId:detail.circle.id,expectedRevision:tab==='avatar'?self?.avatarRevision||0:detail.appearance?.revision||0,...(tab==='avatar'?{avatar}:{themeId})};
  const previous=pending.current;
  const eventKey=previous?.operation===operation&&JSON.stringify(previous.payload)===JSON.stringify(payload)?previous.eventKey:crypto.randomUUID();
  pending.current={operation,payload,eventKey};
  let saved=false;
  try{await request(operation,{...payload,eventKey});saved=true;pending.current=null;await onSaved();setNotice(tab==='avatar'?'Avatar saved across your Circles.':'Circle theme saved.');}
  catch(failure){setError(saved?'Appearance saved, but the Circle could not refresh. Reload before making another change.':failure instanceof Error?failure.message:'Could not save appearance. Reload the Circle before retrying a changed version.');}
  finally{setBusy(false);}
 }
 const theme=circleTheme(themeId);
 return <><button type="button" className={secondary} onClick={open}>Customize</button><dialog ref={dialog} className={styles.dialog} aria-labelledby="circle-customize-title" onClose={()=>{uploadVersion.current++;}} onCancel={event=>{if(busy)event.preventDefault();}}>
  <header className={styles.header}><div><p className={styles.eyebrow}>Make yourself at home</p><h2 id="circle-customize-title">Customize your clubhouse</h2></div><button type="button" className={secondary} disabled={busy} onClick={()=>dialog.current?.close()} aria-label="Close customization">Close</button></header>
  <div className={styles.tabs} role="group" aria-label="Customize"><button type="button" className={secondary} aria-pressed={tab==='avatar'} disabled={busy} onClick={()=>{setTab('avatar');setError('');setNotice('');}}>My avatar</button><button type="button" className={secondary} aria-pressed={tab==='theme'} disabled={busy} onClick={()=>{setTab('theme');setError('');setNotice('');}}>Circle theme</button></div>
  {tab==='avatar'?<section className={styles.content} aria-label="My avatar"><p>Your avatar follows you across Circles. Members and their permitted agents can see it; it doesn’t reveal live activity.</p><div className={styles.avatarPreview}><AvatarPreview avatar={avatar} state={state}/></div><label>Preview motion <select value={state} onChange={event=>setState(event.target.value)}><option value="idle">Idle</option><option value="walking">Walking</option><option value="celebrating">Celebrating</option></select></label><div className={styles.choices}>{companions.map(companion=><button type="button" key={companion.id} aria-label={`Choose ${companion.name}`} aria-pressed={avatar.kind==='builtin'&&avatar.id===companion.id} disabled={busy} onClick={()=>{uploadVersion.current++;setAvatar({kind:'builtin',id:companion.id});setNotice('');}}><AvatarPreview avatar={{kind:'builtin',id:companion.id}}/><span>{companion.name}</span></button>)}</div><label>Upload format <select value={uploadKind} disabled={busy} onChange={event=>{uploadVersion.current++;setUploadKind(event.target.value as 'image'|'sheet');}}><option value="image">Transparent still PNG</option><option value="sheet">Animated PNG sprite sheet</option></select></label><label className={styles.upload}>Choose your own image<input type="file" accept="image/png" disabled={busy} onChange={async event=>{const file=event.target.files?.[0],version=++uploadVersion.current;event.target.value='';if(!file)return;setBusy(true);setError('');try{const next=await readAvatar(file,uploadKind);if(version===uploadVersion.current){setAvatar(next);setNotice('Preview ready. Save to share this avatar with your Circles.');}}catch(failure){if(version===uploadVersion.current)setError(failure instanceof Error?failure.message:'Could not open image.');}finally{setBusy(false);}}}/></label><p className={styles.hint}>PNG · up to 128 KB · still ≤512 × 512 · animation 768 × 624. Only upload artwork you have permission to share.</p></section>:<section className={styles.content} aria-label="Circle theme"><p>{detail.circle.owner?'Choose a complete room for everyone. Personal avatars stay unchanged.':'Only the Circle owner can apply a theme. You can preview the reviewed packs here.'}</p><div className={styles.roomPreview} data-ambience={theme.ambience} style={{backgroundImage:`url('${theme.background}')`,borderColor:theme.palette.accent}}/><div className={styles.choices}>{circleThemes.map(pack=><button type="button" key={pack.id} aria-pressed={themeId===pack.id} disabled={busy} onClick={()=>{setThemeId(pack.id);setNotice('');}}><strong>{pack.name}</strong><small>{pack.credit}</small></button>)}</div><p className={styles.hint}>The beta starts with one room and two lighting palettes. Creator packs are reviewed before joining this catalog.</p></section>}
  <details className={styles.creator}><summary>Create your own</summary><p>Describe yourself or a character to your image tool. Developers can author distinct rooms with the JSON template; submit the manifest and local assets for review through a repository pull request. No scripts run inside installed packs.</p><a href="/circles/creator-kit.json" download>Download creator template</a><button type="button" className={secondary} onClick={()=>void navigator.clipboard.writeText(creatorPrompt).then(()=>setNotice('Creator prompt copied.')).catch(()=>setError('Clipboard unavailable. Select and copy the prompt below.'))}>Copy AI prompt</button><textarea readOnly aria-label="Creator AI prompt" value={creatorPrompt}/></details>
  {error&&<p role="alert" className={styles.error}>{error} Close and reopen after reloading if the saved version changed.</p>}<p role="status">{notice}</p><footer className={styles.footer}><span>{tab==='avatar'?'Visible to your Circle memberships':'Shared room · owner controlled'}</span><button type="button" className={primary} disabled={busy||(!detail.circle.owner&&tab==='theme')||!self} onClick={()=>void save()}>{busy?'Working…':tab==='avatar'?'Save my avatar':'Apply Circle theme'}</button></footer>
 </dialog></>;
}
