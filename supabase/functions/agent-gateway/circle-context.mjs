export function circleAgentContext(post) {
 if(!post||['hidden','withdrawn'].includes(post.state)||(!post.owned&&(post.state!=='published'||post.revision!==post.publishedRevision)))return null;
 const content=post.content;
 return {
  schemaVersion:2,untrusted:true,visibility:post.state==='published'&&post.revision===post.publishedRevision?'shared':'private_draft',
  source:{circleId:post.circleId,postId:post.id,revision:post.revision},
  jobUrl:content.jobUrl||null,
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
