import {validateSharedContexts} from './context-attachments.mjs';
export function circleAgentContext(post) {
 if(!post||['hidden','withdrawn'].includes(post.state)||(!post.owned&&(post.state!=='published'||post.revision!==post.publishedRevision)))return null;
 const content=post.content;
 return {
  schemaVersion:2,untrusted:true,visibility:post.state==='published'&&post.revision===post.publishedRevision?'shared':'private_draft',
  source:{circleId:post.circleId,postId:post.id,revision:post.revision},
  jobUrl:content.jobUrl||null,
  jobId:content.jobId||null,
  offers:content.offers?.map(offer=>({...offer}))||null,
  contexts:content.contexts?.map(item=>({...item}))||[],
  stage:content.stage||null,
  insight:content.insight||content.body,
  company:content.company||null,
  role:content.role||null,
  experienceDate:content.experienceDate||null,
  provenance:content.provenance,
  uncertainty:content.uncertainty||null,
  sources:content.sources.map(source=>({...source})),
 };
}

export function validateCircleContextContent(content) {
 if(content.contexts!==undefined)validateSharedContexts(content.contexts);
 if(content.jobId!==undefined&&content.jobId!==null&&(typeof content.jobId!=='string'||!content.jobId.trim()||content.jobId.length>200))throw Error('Job ID must be text, up to 200 characters.');
 if(content.offers!==undefined){
  if(content.type!=='offer_comparison'||!Array.isArray(content.offers)||content.offers.length<2||content.offers.length>4)throw Error('Attach two to four offers to an offer comparison.');
  for(const offer of content.offers){
   if(!offer||typeof offer!=='object'||Array.isArray(offer)||typeof offer.company!=='string'||!offer.company.trim())throw Error('Each offer needs a company.');
   for(const [key,value] of Object.entries(offer))if(!['company','role','location','base','equity','signOn','notes'].includes(key)||typeof value!=='string'||value.length>(key==='notes'?1000:200))throw Error('Invalid offer details.');
  }
 }
 if(content.type==='offer_comparison'&&!content.offers)throw Error('Attach at least two offers.');

 if(content.insight!==undefined&&content.insight!==null&&(typeof content.insight!=='string'||content.insight.length>4000))throw Error('Insight must be text, up to 4000 characters.');
 if(typeof content.body!=='string'||content.body.length>12000||!content.body.trim()&&!content.insight?.trim()||content.type==='reply'&&!content.body.trim())throw Error('Add an insight or a message before saving.');
 if(content.jobUrl!==undefined&&content.jobUrl!==null&&(typeof content.jobUrl!=='string'||content.jobUrl.length>2000||!/^https:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^\s]*)?$/.test(content.jobUrl)))throw Error('Use a public HTTPS job link.');
 if(JSON.stringify(content).match(/storage\/v1\/object\/(sign|authenticated)\/|[?&](token|access_token|apikey|api_key|signature|x-amz-signature)=|mail\.google\.com\/|outlook\.office\.com\/mail\//i))throw Error('Private sources and signed file links cannot be shared.');
}

export function circleKnowledgeResponse(operation,data) {
 if(!data||data.available===false)return data;
 const project=post=>({...post,agentContext:circleAgentContext(post)});
 if(operation==='knowledge.search')return {...data,items:data.items.map(project)};
 if(operation==='knowledge.read')return {...data,post:project(data.post),replies:data.replies.map(project)};
 return data;
}
