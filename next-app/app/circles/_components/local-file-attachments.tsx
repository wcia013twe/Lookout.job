'use client';
import {useEffect,useRef,useState} from 'react';
import {circleFileAccept,fileSizeLabel,localCircleFile} from '../../../lib/circle-local-files.mjs';
import styles from './prompt-composer.module.css';
export type LocalCircleFile={id:string;file:File;url:string;name:string;mime:string;bytes:number;kind:string;extension:string};
export function useLocalCircleFiles(count:number){
 const [files,setFiles]=useState<LocalCircleFile[]>([]),[error,setError]=useState('');
 const urls=useRef(new Set<string>());
 useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();},[]);
 function addFiles(incoming:FileList|File[]){
  try{
   const unique=Array.from(incoming).filter((file,index,all)=>!files.some(item=>item.file.name===file.name&&item.file.size===file.size&&item.file.lastModified===file.lastModified)&&all.findIndex(other=>other.name===file.name&&other.size===file.size&&other.lastModified===file.lastModified)===index);
   if(files.length+count+unique.length>6)throw Error('Attach up to six context items and files in total.');
   const checked=unique.map(file=>({file,...localCircleFile(file)}));
   const additions=checked.map(item=>{const url=URL.createObjectURL(item.file);urls.current.add(url);return {...item,id:crypto.randomUUID(),url};});
   setFiles(old=>[...old,...additions]);setError('');
  }catch(e){setError(e instanceof Error?e.message:'This file could not attach. Try another file.');}
 }
 function removeFile(id:string){const file=files.find(item=>item.id===id);if(file){URL.revokeObjectURL(file.url);urls.current.delete(file.url);}setFiles(old=>old.filter(item=>item.id!==id));setError('');}
 return {files,addFiles,removeFile,error};
}
function FileIcon(){return <svg aria-hidden="true" width="24" height="28" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 2h9l5 5v19H5V2Z"/><path d="M14 2v6h5M8 14h8M8 18h8"/></svg>;}
export default function LocalFileAttachments({files,remove}:{files:LocalCircleFile[];remove:(id:string)=>void}){
 if(!files.length)return null;
 return <div className={styles.localFiles} aria-label="Local file attachments">{files.map(item=><div className={styles.fileToken} key={item.id}>
  <details><summary>{item.kind==='image'?<img src={item.url} alt=""/>:<FileIcon/>}<span><strong title={item.name}>{item.name}</strong><small>{item.extension.toUpperCase()} · {fileSizeLabel(item.bytes)} · Local preview</small></span></summary><div className={styles.filePreview}>{item.kind==='image'&&<img src={item.url} alt={item.name}/>}<a href={item.url} download={item.name}>Download local copy</a></div></details>
  <button type="button" aria-label={`Remove file ${item.name}`} onClick={()=>remove(item.id)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
 </div>)}<p className={styles.localNotice}>Local previews only. Files aren’t uploaded or included in posts yet. Remove them to save your post.</p></div>;
}
export {circleFileAccept};
