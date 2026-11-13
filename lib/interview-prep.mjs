import {applicationRounds} from './application-rounds.mjs';

const kindFor = item => {
 const kind=item?.content?.kind||item?.kind;
 if(['company_research','read_up','explainer','resource'].includes(kind))return 'research';
 if(['interview_brief','weekly_prep'].includes(kind))return 'round brief';
 if(['notes','interview_debrief'].includes(kind))return 'notes';
 if(kind==='story_bank'||kind==='application_template')return 'reusable answer';
 if(['practice','mock_interview'].includes(kind))return 'practice';
 return null;
};
const contentOf=item=>item?.content||item||{};
const dateFor=item=>{
 const content=contentOf(item);
 for(const value of [content.scheduledAt,content.prepOn,content.preparedFor,content.date]){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)&&Number.isFinite(Date.parse(value)))return value.slice(0,10);
 }
 return null;
};
const active=item=>{
 const content=contentOf(item);
 return !content.archived&&!['completed','cancelled'].includes(content.sessionStatus)&&content.completed!==true;
};

/** Project explicitly application-linked preparation materials without changing source records. */
export function buildInterviewPipelines(items=[],applications=[],now=new Date()){
 const today=(now instanceof Date?now:new Date(now)).toISOString().slice(0,10);
 const appById=new Map();
 for(const application of applications){for(const id of [application.id,application.backendId].filter(Boolean))appById.set(id,application);}
 const pipelines=applications.map(application=>({application,upcoming:[],active:[],previous:[],rounds:applicationRounds(application)}));
 const pipelineByApplication=new Map();
 for(const pipeline of pipelines)for(const id of [pipeline.application.id,pipeline.application.backendId].filter(Boolean))pipelineByApplication.set(id,pipeline);
 const unassigned=[];
 for(const item of items){
  const content=contentOf(item),kind=kindFor(item);
  if(!kind)continue;
  const link=(Array.isArray(content.links)?content.links:[]).find(entry=>entry&&typeof entry.applicationId==='string'&&pipelineByApplication.has(entry.applicationId));
  const row={item,kind,date:dateFor(item)};
  const pipeline=link&&pipelineByApplication.get(link.applicationId);
  if(!pipeline){unassigned.push(row);continue;}
  if(row.date&&row.date>=today&&active(item))pipeline.upcoming.push(row);
  else if(active(item)&&!row.date)pipeline.active.push(row);
  else pipeline.previous.push(row);
 }
 const order=(a,b)=>(a.date||'').localeCompare(b.date||'');
 for(const pipeline of pipelines){pipeline.upcoming.sort(order);pipeline.previous.sort((a,b)=>order(b,a));}
 return {pipelines,unassigned};
}
