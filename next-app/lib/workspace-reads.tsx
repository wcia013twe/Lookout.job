"use client";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { subscribePreparationRefresh } from './action-board.mjs';
import { useWorkspace } from './workspace';

const sources = {
 search: {tables:['preferences','agent_tasks','posting_evidence'], paths:['workflow.searchPreferences']},
 imports: {tables:['imported_jobs'], paths:['demo.boardImports']},
 planner: {
  tables:['applications','submission_attempts','application_milestones','preparation_plans','preparation_planner_settings','preparation_sessions','career_artifacts','learning_goals','preferences','imported_jobs','application_work_holds'],
  paths:['workflow.applications','workflow.preparationPlans','workflow.preparationPlanner','workflow.searchPreferences','demo.preparationRows','demo.plannerSettings','demo.preparationSessions','demo.learningGoals','demo.artifacts','demo.boardImports'],
 },
 artifacts: {tables:['career_artifacts','career_artifact_feedback'], paths:[]},
};
type Source = keyof typeof sources | 'circles';
type Entry = {request:Promise<unknown>; expires:number; settled?:boolean; value?:unknown};

function createReads() {
 const entries = new Map<string, Entry>();
 const revisions: Record<Source, number> = {search:0,imports:0,planner:0,artifacts:0,circles:0};
 const listeners = new Set<() => void>();
 function invalidate(source: Source, notify = true) {
  for (const key of entries.keys()) if (key.startsWith(source + ':')) entries.delete(key);
  if (notify) {
   revisions[source]++;
   for (const listener of listeners) listener();
  }
 }
 function read<T>(source: Source, key: string, load: () => Promise<T>, ttl = Infinity): Promise<T> {
  const id = source + ':' + key;
  const existing = entries.get(id);
  if (existing && existing.expires > Date.now()) return existing.request as Promise<T>;
  const request = Promise.resolve().then(load);
  const entry: Entry = {request,expires:Infinity};
  entries.set(id,entry);
  void request.then(value => {
   entry.value = value;
   entry.settled = true;
   entry.expires = Date.now() + ttl;
   if (entries.size > 150 && entries.get(id) === entry) {
    const oldest = [...entries.keys()].find(key => key !== id && /^(artifacts|circles|search):/.test(key) && entries.get(key)?.settled);
    if (oldest) entries.delete(oldest);
   }
  }, () => { if (entries.get(id) === entry) entries.delete(id); });
  return request;
 }
 function peek<T>(source: Source,key: string) {
  const entry=entries.get(source+':'+key);
  return entry && entry.expires>Date.now() ? entry.value as T | undefined : undefined;
 }
 return {read,peek,invalidate,revision:(source: Source)=>revisions[source],subscribe(listener:()=>void){
  listeners.add(listener);
  return () => { listeners.delete(listener); };
 }};
}

const Context = createContext<ReturnType<typeof createReads> | null>(null);
const families = Object.keys(sources) as (keyof typeof sources)[];

export function WorkspaceReadsProvider({children}: {children:ReactNode}) {
 const w = useWorkspace();
 const scope = w.demo ? `demo:${w.demoEpoch}` : `account:${w.user?.id || ''}:${w.state?.resetEpoch || ''}`;
 return <ScopedReads key={scope}>{children}</ScopedReads>;
}

function ScopedReads({children}: {children:ReactNode}) {
 const [reads] = useState(createReads);
 const {demo,store,user} = useWorkspace();
 const owner = user?.id;
 useEffect(() => {
  if (demo) {
   const stopStore = store?.subscribe('', (_state: unknown, path: string) => {
    for (const source of families) {
     if (!path || sources[source].paths.some(parent => parent === path || parent.startsWith(path + '.') || path.startsWith(parent + '.'))) reads.invalidate(source);
    }
   });
   const stopBoard = subscribePreparationRefresh(document, window, 'demo', () => reads.invalidate('planner'), ['application_work_holds']);
   return () => { stopStore?.(); stopBoard(); };
  }
  if (!owner) return;
  const stops = families.map(source => subscribePreparationRefresh(document,window,owner,()=>reads.invalidate(source),sources[source].tables));
  return () => stops.forEach(stop => stop());
 }, [demo,owner,reads,store]);
 return <Context.Provider value={reads}>{children}</Context.Provider>;
}

export function useWorkspaceReads() {
 const reads = useContext(Context);
 if (!reads) throw Error('Workspace reads provider is missing.');
 return reads;
}

export function useReadRevision(source: Source) {
 const reads = useWorkspaceReads();
 const getRevision = useCallback(() => reads.revision(source), [reads,source]);
 return useSyncExternalStore(reads.subscribe,getRevision,getRevision);
}
