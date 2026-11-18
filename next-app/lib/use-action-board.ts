"use client";
import {createContext,createElement,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createBackend} from '../../backend/client.mjs';
import {useWorkspace} from './workspace';
import {subscribePreparationRefresh} from './action-board.mjs';
export type BoardItem={key:string;kind:string;sourceId:string;version:string;createdAt:string;employmentType?:string;status?:string;appliedDate?:string;actionDate?:string;applicationId?:string;company?:string;role?:string;title?:string;body?:string;recipient?:string;destination?:string;subject?:string;proposedAt?:string;timeZone?:string;reason:string;href:string;requiresReview:boolean;reviewed:boolean;canAccept:boolean;canReject:boolean;inferences?:{field:string;reason:string}[];coverLetterSource?:string;coverLetter?:string;blocker?:string;resume?:{id:string;name:string;version?:string};reference?:{id:string;kind:string;label:string;detail?:string;href:string};questions?:{question:string;answer:string;answerSource?:string;questionSource?:string;inferenceNote?:string;profileField?:string;savedAnswerId?:string;preferenceField?:string;required?:boolean;fieldType?:string;options?:any[]}[]};
export type BoardSnapshot={trackerWork?:import('../components/tracker-work-list').TrackerWork[];outreach?:{sourceId:string;response:string;body:string;subject:string;recipient:string}[];items:BoardItem[];holds:{application_id:string;resumed_at:string|null;version:number}[];history:{decision_key:string;source_kind?:string;source_id?:string;source_summary?:{action?:string};response:string;responded_at:string}[]};
const boardTables = [
 'applications','submission_attempts','application_milestones','action_inbox',
 'imported_jobs','outreach_contacts','answer_library','preferences','profiles',
 'application_work_holds','action_decision_receipts',
];
const demoBoardPaths = ['workflow.applications','workflow.resumes','workflow.savedAnswers','network.referrals','demo.boardImports'];
const ActionBoardContext = createContext<ReturnType<typeof useBoardState> | null>(null);

export function ActionBoardProvider({children}: {children: ReactNode}) {
 const w = useWorkspace();
 const scope = w.demo ? `demo:${w.demoEpoch}` : `account:${w.user?.id || ''}:${w.state?.resetEpoch || ''}`;
 return createElement(ScopedBoard, {key: scope, children});
}

function ScopedBoard({children}: {children: ReactNode}) {
 const board = useBoardState();
 return createElement(ActionBoardContext.Provider, {value: board}, children);
}

export function useActionBoard() {
 const board = useContext(ActionBoardContext);
 if (!board) throw Error('Action Board provider is missing.');
 return board;
}

function useBoardState() {
 const w = useWorkspace();
 const owner = w.demo ? 'demo' : w.user?.id || null;
 const {client, demo, services, store} = w;
 const api = useMemo(() => services || (owner && client ? createBackend(client, owner) : null), [client, owner, services]);
 const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const epoch = useRef(0);
 const pending = useRef<{signature: string; payload: any} | null>(null);
 const mutating = useRef(false);
 const reading = useRef<Promise<void> | null>(null);
 const refreshQueued = useRef(false);

 const refresh = useCallback(() => {
  if (!api?.readActionBoard) return;
  refreshQueued.current = true;
  if (reading.current) return reading.current;

  const version = epoch.current;
  // A change received mid-read needs a new snapshot after the current request.
  reading.current = Promise.resolve().then(async () => {
   try {
    while (version === epoch.current && refreshQueued.current) {
     refreshQueued.current = false;
     try {
      const data = await api.readActionBoard();
      if (version === epoch.current && !refreshQueued.current) {
       setSnapshot(data);
       setError('');
      }
     } catch {
      if (version === epoch.current && !refreshQueued.current) {
       setError('Action Board could not refresh. Reload before making a decision.');
      }
     }
    }
   } finally {
    if (version === epoch.current) reading.current = null;
   }
  });
  return reading.current;
 }, [api]);

 useEffect(() => {
  if (!owner || !api) return;
  const unsubscribe = subscribePreparationRefresh(document, window, owner, refresh, boardTables);
  const unsubscribeDemo = demo ? store?.subscribe('', (_state: unknown, path: string) => {
   if (!path || demoBoardPaths.some(source => source === path || source.startsWith(path + '.') || path.startsWith(source + '.'))) {
    void refresh();
   }
  }) : undefined;
  void refresh();
  return () => {
   unsubscribe();
   unsubscribeDemo?.();
   epoch.current++;
   reading.current = null;
   refreshQueued.current = false;
  };
 }, [api, demo, owner, refresh, store]);

 async function respond(item:Pick<BoardItem,'key'> & {version?:string},response:string,policy?:string,input?:Record<string,unknown>){
  if(mutating.current||!api)throw Error('Wait for the current decision to finish.');
  const signature=JSON.stringify({key:item.key,response,...(response==='resume'?{expectedVersion:Number(item.version)}:{}),...(policy?{policy}:{}),...(input?{input}:{})});
  if(pending.current?.signature!==signature)pending.current={signature,payload:{...JSON.parse(signature),eventKey:crypto.randomUUID()}};
  const version=epoch.current;mutating.current=true;setBusy(true);setError('');
  try{await api.respondActionBoard(pending.current.payload);if(version!==epoch.current)return;pending.current=null;
   document.dispatchEvent(new CustomEvent('workspace:cloud-ready',{detail:{userId:owner}}));
   await reading.current;
   if(version===epoch.current&&!demo)await window.JB?.cloud?.refresh?.();
  }
  catch(e){if(version===epoch.current)setError('The decision changed or could not save. Reload and review its current version.');throw e;}
  finally{if(version===epoch.current){mutating.current=false;setBusy(false);}}
 }
 async function saveMessage(item:BoardItem,fields:{subject:string;message:string}){
  if(mutating.current||!api)throw Error('Wait for the current save to finish.');
  const version=epoch.current;mutating.current=true;setBusy(true);
  try{await api.saveActionBoardMessage({id:item.sourceId,expectedRevision:Number(item.version),...fields});if(version===epoch.current)await refresh();}
  finally{if(version===epoch.current){mutating.current=false;setBusy(false);}}
 }
 return {snapshot,error,busy,refresh,respond,saveMessage};
}
