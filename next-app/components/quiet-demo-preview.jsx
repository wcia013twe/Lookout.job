"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { secondary, Notice } from './ui';
export default function QuietDemoPreview() {
 const w=useWorkspace(),[preview,setPreview]=useState(null);
 async function inspect(scenario){setPreview(await w.services.readDeliveryPolicy(scenario));}
 return <div className="mt-5 border-t border-board-line pt-4">
   <h3 className="font-semibold">Preview a fictional Muse update</h3>
   <p className="mt-2 text-sm text-board-muted">Compare routine progress with a decision that needs you. This preview sends no message.</p>
   <div className="mt-3 flex flex-wrap gap-2"><button className={secondary} onClick={()=>inspect('routine')}>Routine progress</button><button className={secondary} onClick={()=>inspect('decision')}>Important decision</button></div>
   {preview && <Notice>{preview.delivery.decision==='due'?'Muse would notify you now.':'Muse would hold this update for your next digest.'} {preview.events[0].summary}</Notice>}
 </div>;
}
