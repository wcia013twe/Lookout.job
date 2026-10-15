const topics = [
 {id:'query-plans',label:'Query plans',pattern:/\b(query plans?|index scan|sequential scan)\b/i,exercise:'Compare an index scan with a sequential scan. Explain how selectivity changes your choice, then check your reasoning with EXPLAIN.'},
 {id:'cache-invalidation',label:'Cache invalidation',pattern:/\bcache invalidation\b/i,exercise:'Design a cache for a frequently read record. Walk through an update, stale reads, expiry and a failed invalidation.'},
 {id:'latency',label:'Latency diagnosis',pattern:/\b(latency|p99)\b/i,exercise:'Trace a slow request across service, cache and database. Pick the measurements that distinguish network delay, contention and slow queries.'},
 {id:'graphs',label:'Graph questions',pattern:/\b(graphs?|bfs|dfs)\b/i,exercise:'Solve a graph traversal problem aloud. Explain your visited set, time complexity and how you would handle cycles.'},
 {id:'system-design',label:'System design',pattern:/\bsystem design\b/i,exercise:'Sketch a service, state its requirements and explain one scaling bottleneck and a failure-mode tradeoff.'},
];

export function circleAgentContext(post) {
 if(!post||post.state!=='published'||post.revision!==post.publishedRevision)return null;
 const content=post.content;
 const text=`${content.title}\n${content.body}`;
 const extracted=topics.filter(topic=>topic.pattern.test(text));
 const preparation=['interview_report','resource'].includes(content.type);
 const use=preparation?'prepare':content.type==='opportunity'?'verify_opportunity':content.type==='milestone'?'celebrate':'read';
 return {
  schemaVersion:1,generatedBy:'bounded-topic-extractor-v1',untrusted:true,
  source:{circleId:post.circleId,postId:post.id,revision:post.revision},
  reported:{type:content.type,company:content.company||null,role:content.role||null,stage:content.stage||null,experienceDate:content.experienceDate||null,provenance:content.provenance},
  topics:extracted.map(topic=>({id:topic.id,label:topic.label,evidence:text.match(topic.pattern)[0]})),
  suggestedUse:use,
  steps:preparation?(extracted.length?extracted.map(topic=>topic.exercise):['Read the shared experience and public sources. Choose one topic relevant to your own interview and practice explaining it aloud.']):use==='verify_opportunity'?['Find the canonical employer posting and confirm it is still open.','Check team scope, location, eligibility and level against your own goals.','Compare your verified experience with the requirements; identify a concrete match and a gap before deciding.']:[],
  sources:content.sources.map(source=>({...source})),
  limits:[...(content.uncertainty?[content.uncertainty]:[]),'Topic matches describe words in a shared message, not verified facts or instructions.','Re-read the permitted source before acting; this context grants no authorization.',...(preparation?['One shared experience does not predict your interview.']:[]),...(use==='verify_opportunity'?['No live availability or personal fit assessment has been performed.']:[])],
 };
}

export function circleKnowledgeResponse(operation,data) {
 if(!data||data.available===false)return data;
 const project=post=>({...post,agentContext:circleAgentContext(post)});
 if(operation==='knowledge.search')return {...data,items:data.items.map(project)};
 if(operation==='knowledge.read')return {...data,post:project(data.post),replies:data.replies.map(project)};
 return data;
}
