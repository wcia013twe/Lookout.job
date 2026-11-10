// Harness-only ticking wall clock. Never imported by production entry points.
import {readFileSync} from 'node:fs';
export function virtualDate(NativeDate,readOffset) {
 const now=()=>{
  const offset=readOffset();
  if(!Number.isFinite(offset)||Math.abs(offset)>315576000)throw Error('Invalid isolated clock offset');
  return NativeDate.now()+offset*1000;
 };
 return new Proxy(NativeDate,{
  apply:()=>new NativeDate(now()).toString(),
  construct:(target,args,newTarget)=>Reflect.construct(target,args.length?args:[now()],newTarget),
  get:(target,key,receiver)=>key==='now'?now:Reflect.get(target,key,receiver),
 });
}
export function readClockOffset(file) {
 const text=readFileSync(file,'utf8');
 if(text.length>128||!/^[-+]\d+(?:\.\d{1,6})?\s*$/.test(text))throw Error('Invalid isolated clock file');
 return Number(text);
}
const env=key=>typeof Deno!=='undefined'?Deno.env.get(key):process.env[key];
if(env('LOOKOUT_JOB_CLOCK_FILE')) {
 if(env('LOOKOUT_JOB_CLOCK_FIXTURE')!=='1')throw Error('Isolated clock requires explicit fixture opt-in');
 const path=env('LOOKOUT_JOB_CLOCK_FILE');readClockOffset(path);
 globalThis.Date=virtualDate(globalThis.Date,()=>readClockOffset(path));
}
