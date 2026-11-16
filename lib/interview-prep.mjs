import {applicationRounds} from './application-rounds.mjs';
import {hasTerminalOutcome} from './application-timeline.mjs';

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
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)&&Number.isFinite(Date.parse(value)))return value;
 }
 return null;
};
const active=item=>{
 const content=contentOf(item);
 return !content.archived&&!['completed','cancelled'].includes(content.sessionStatus)&&content.completed!==true;
};
const order=(a,b)=>(a.date||'').localeCompare(b.date||'');

/** Project only explicitly application-linked materials and real saved rounds. */
export function buildInterviewPipelines(items=[],applications=[],now=new Date()){
 const today=(now instanceof Date?now:new Date(now)).toISOString().slice(0,10);
 const pipelines=applications.map(application=>({application,upcoming:[],active:[],previous:[],rounds:applicationRounds(application)}));
 const pipelineByApplication=new Map();
 for(const pipeline of pipelines)for(const id of [pipeline.application.id,pipeline.application.backendId].filter(Boolean))pipelineByApplication.set(id,pipeline);
 const unassigned=[];
 for(const item of items){
  const content=contentOf(item),kind=kindFor(item);
  if(!kind){unassigned.push({item,kind:null,date:dateFor(item)});continue;}
  const links=Array.isArray(content.links)?content.links:[];
  const applicationIds=links.map(link=>link?.applicationId).filter(id=>typeof id==='string');
  const row={item,kind,date:dateFor(item)};
  const pipeline=applicationIds.map(id=>pipelineByApplication.get(id)).find(Boolean);
  if(!pipeline){unassigned.push(row);continue;}
  if(row.date&&row.date.slice(0,10)>=today&&active(item))pipeline.upcoming.push(row);
  else if(active(item)&&!row.date)pipeline.active.push(row);
  else pipeline.previous.push(row);
 }
 for(const pipeline of pipelines){pipeline.upcoming.sort(order);pipeline.active.sort(order);pipeline.previous.sort((a,b)=>order(b,a));}
 return {pipelines,unassigned};
}

export function latestCompanyResearch(items=[],application){
 const ids=[application?.id,application?.backendId].filter(Boolean);
 const matches=items.filter(item=>item?.content?.kind==='company_research'&&item.content.links?.some(link=>ids.includes(link.applicationId)));
 return matches.sort((a,b)=>String(b.updatedAt||b.updated_at||b.content?.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.updated_at||a.content?.updatedAt||a.createdAt||'')));
}

const markdownSection=(body,heading)=>{
 if(typeof body!=='string')return '';
 const lines=body.split(/\r?\n/),start=lines.findIndex(line=>/^#{1,3}\s+/.test(line)&&line.replace(/^#{1,3}\s+/,'').trim().toLowerCase()===heading.toLowerCase());
 if(start<0)return '';
 const result=[];
 for(let index=start+1;index<lines.length;index++){if(/^#{1,3}\s+/.test(lines[index]))break;result.push(lines[index]);}
 return result.join('\n').trim();
};
export function artifactCategory(item,fallback){
 const explicit=item?.content?.category||markdownSection(item?.content?.body,'Category')||markdownSection(item?.body,'Category');
 return typeof explicit==='string'&&explicit.trim()?explicit.trim():fallback;
}
export function answerEntry(item){
 const body=item?.content?.body||item?.body||'';
 return {category:artifactCategory(item,item?.content?.kind==='story_bank'?'Stories':'Reusable answers'),status:markdownSection(body,'Status'),question:markdownSection(body,'Question'),answer:markdownSection(body,'Answer'),experiences:markdownSection(body,'Experiences'),companyAdaptation:markdownSection(body,'Company adaptation')};
}
export function practiceCategory(item){return artifactCategory(item,item?.content?.kind==='mock_interview'?'Mock interviews':'Practice');}

export function roundMaterials(items=[],applicationIds=[],tasks=[],roundId){
 const taskIds=new Set(tasks.filter(task=>task.roundId===roundId).map(task=>task.id));
 return items.filter(item=>contentOf(item).links?.some(link=>applicationIds.includes(link.applicationId)&&taskIds.has(link.taskId)));
}

export const answerCategories=['Introductions and motivation','Behavioral questions','Project and experience stories','Technical explanations','Questions to ask interviewers'];
export const answerStatuses=['Draft','Needs Review','Ready'];
export const answerSections=['Category','Status','Question','Answer','Experiences','Company adaptation'];
export function readStructuredAnswer(body=''){
 const headings=[...body.matchAll(/^## (.+)\r?$/gm)];
 if(headings.length!==answerSections.length||body.slice(0,headings[0]?.index).trim()||headings.some((heading,index)=>heading[1]!==answerSections[index]))return null;
 const values=Object.fromEntries(headings.map((heading,index)=>[heading[1],body.slice(heading.index+heading[0].length,headings[index+1]?.index??body.length).trim()]));
 return answerCategories.includes(values.Category)&&answerStatuses.includes(values.Status)?values:null;
}

export function interviewPipelineOrder(pipelines=[],now=new Date()){
 const today=new Date(now).toISOString().slice(0,10);
 return pipelines.map((pipeline,index)=>{
  const rounds=pipeline.rounds.filter(round=>!round.cancelled);
  const nextRound=rounds.filter(round=>round.phase!=='completed'&&round.date&&round.date.slice(0,10)>=today).sort((first,second)=>Date.parse(first.date)-Date.parse(second.date))[0]||null;
  const previous=pipeline.application.archived||hasTerminalOutcome(pipeline.application)||['closed','rejected','withdrawn'].includes(String(pipeline.application.status).toLowerCase())||(!nextRound&&rounds.length>0&&rounds.every(round=>round.phase==='completed'||(round.date&&round.date.slice(0,10)<today)));
  return {...pipeline,nextRound,group:previous?'Previous':nextRound?'Upcoming interviews':'Active · date not set',index};
 }).sort((first,second)=>{
  const rank=group=>group==='Upcoming interviews'?0:group==='Previous'?2:1;
  return rank(first.group)-rank(second.group)||(first.nextRound&&second.nextRound?Date.parse(first.nextRound.date)-Date.parse(second.nextRound.date):0)||first.index-second.index;
 });
}
