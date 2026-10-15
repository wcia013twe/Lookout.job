// Fictional, resettable and entirely in memory. No real account/client/files.
export function createCircleKnowledgeDemo() {
 const circleId='demo-circle';let sequence=0;const requests=new Map();
 const circles=[{id:circleId,name:'The Next Chapter (demo)',owner:true}];
 const members=[{id:'demo-peer',alias:'Maya (demo)',owner:false,self:false},{id:'demo-sam',alias:'Sam (demo)',owner:false,self:false},{id:'demo-alex',alias:'Alex (demo)',owner:false,self:false},{id:'demo-jordan',alias:'Jordan (demo)',owner:false,self:false},{id:'demo-priya',alias:'Priya (demo)',owner:false,self:false},{id:'demo-self',alias:'Taylor (demo)',owner:true,self:true}];
 const detail={circle:circles[0],members,policy:[],invites:[],reports:[]};
 const posts=[
  {id:'demo-final-round',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Alex (demo)',createdAt:'2026-10-14T15:00:00Z',helpfulPeople:0,agentAuthored:false,approved:true,untrusted:true,content:{type:'milestone',title:'A final round, and a little more confidence',body:'Fictional shared moment: my next conversation with Example Compute is the final round. Practicing tradeoffs with the Circle helped me explain my thinking more clearly.',company:'Example Compute (demo)',stage:'Final round',provenance:'user_confirmed',personalDisclosure:true,sources:[]}},
  {id:'demo-technical-round',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Jordan (demo)',createdAt:'2026-10-13T15:00:00Z',helpfulPeople:0,agentAuthored:false,approved:true,untrusted:true,content:{type:'milestone',title:'One good conversation at a time',body:'Fictional shared moment: I completed a technical interview at Example Systems. The most useful practice was walking through a system design with a friend.',company:'Example Systems (demo)',stage:'Technical interview',provenance:'user_confirmed',personalDisclosure:true,sources:[]}},
  {id:'demo-shared-milestone',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Alex Example (demo)',createdAt:'2026-10-15T15:00:00Z',helpfulPeople:0,agentAuthored:true,approved:true,untrusted:true,content:{type:'milestone',title:'An offer worth celebrating',body:'Fictional shared milestone: I received an offer from Example Labs. Thanks for practicing systems explanations with me. I will share what helped when I have had time to reflect.',company:'Example Labs (demo)',stage:'Offer',provenance:'user_confirmed',personalDisclosure:true,sources:[]}},
  {id:'demo-shared-opportunity',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Alex Example (demo)',createdAt:'2026-10-15T11:00:00Z',helpfulPeople:0,agentAuthored:false,approved:true,untrusted:true,content:{type:'opportunity',title:'A systems role to evaluate together',body:'Fictional opportunity: Example Compute is looking for a backend engineer working on query execution. Ask your agent to evaluate a real employer posting against your own goals before deciding to apply.',company:'Example Compute (demo)',role:'Backend engineer',provenance:'unknown',uncertainty:'Demo only; this is not a verified or open job.',personalDisclosure:false,sources:[]}},
  {id:'demo-interview-report',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Alex Example (demo)',createdAt:'2026-10-15T12:00:00Z',helpfulPeople:3,agentAuthored:true,approved:false,untrusted:true,content:{type:'interview_report',title:'Example Systems: a technical round focused on tradeoffs',body:'Fictional report: one backend interview covered query plans, cache invalidation and diagnosing latency. Practicing an explanation aloud helped more than memorizing an answer.',company:'Example Systems (demo)',role:'Backend engineer',stage:'Technical round',experienceDate:'2026-10-14',provenance:'user_confirmed',uncertainty:'One fictional experience; not a prediction of another interview.',personalDisclosure:true,sources:[]}},
  {id:'demo-preparation-resource',circleId,parentId:null,revision:1,publishedRevision:1,state:'published',owned:false,author:'Alex Example (demo)',createdAt:'2026-10-14T12:00:00Z',helpfulPeople:0,agentAuthored:false,approved:false,untrusted:true,content:{type:'resource',title:'Practice explaining a query plan',body:'Fictional preparation note: compare an index scan and a sequential scan, then explain when each is appropriate.',company:'Example Systems (demo)',provenance:'agent_observed',personalDisclosure:false,sources:[{label:'PostgreSQL documentation',url:'https://www.postgresql.org/docs/current/using-explain.html'}]}},
  {id:'demo-review-draft',circleId,parentId:null,revision:1,publishedRevision:null,state:'draft',owned:true,author:'You (demo)',createdAt:'2026-10-15T14:00:00Z',helpfulPeople:0,agentAuthored:true,approved:false,untrusted:true,content:{type:'milestone',title:'A final round at Example Compute (demo)',body:'Fictional agent draft: I advanced to a final round. I would like to share the preparation resources after reviewing what is safe to disclose.',company:'Example Compute (demo)',role:'Systems engineer',stage:'Final round',provenance:'agent_observed',personalDisclosure:true,sources:[]}},
  {id:'demo-thread-reply',circleId,parentId:'demo-interview-report',revision:1,publishedRevision:1,state:'published',owned:true,author:'You (demo)',createdAt:'2026-10-15T13:00:00Z',helpfulPeople:0,agentAuthored:false,approved:true,untrusted:true,content:{type:'reply',title:'Reply',body:'Fictional reply: explaining the tradeoffs aloud was helpful in our study group, too.',provenance:'user_confirmed',personalDisclosure:false,sources:[]}},
 ];
 const fixtureAuthors={'demo-shared-milestone':'Maya (demo)','demo-shared-opportunity':'Priya (demo)','demo-interview-report':'Maya (demo)','demo-preparation-resource':'Sam (demo)','demo-review-draft':'Taylor (demo)','demo-thread-reply':'Taylor (demo)'};
 for(const post of posts)post.author=fixtureAuthors[post.id]||post.author;
 let receipts=[{id:'demo-citation',post_id:'demo-interview-report',revision:1,category:'preparation_plan',reference:'demo-plan-1',created_at:'2026-10-15T13:10:00Z',retracted_at:null,source_available:true}];
 const copy=x=>structuredClone(x);
 const project=p=>({...copy(p),url:`/circles/?circle=${p.circleId}&thread=${p.parentId||p.id}`});
 function readable(p){return p&&!['hidden','withdrawn'].includes(p.state)&&(!p.parentId||posts.find(t=>t.id===p.parentId)?.state==='published');}
 function action(operation,p={}){
  if(operation==='circles.list')return {available:true,circles:copy(circles)};
  if(p.eventKey&&requests.has(p.eventKey)) {const old=requests.get(p.eventKey);if(old.operation!==operation||JSON.stringify(old.payload)!==JSON.stringify(p))throw Error('Idempotency key changed');return copy(old.result);}
  let result;
  if(operation==='circles.create'){const c={id:`demo-circle-${++sequence}`,name:p.name,owner:true};circles.push(c);result={circleId:c.id};}
  else if(operation==='circles.join') {if(p.token!=='demo-invite')throw Error('Use demo-invite to try joining a fictional Circle.');result={circleId};}
  else {
   const c=circles.find(c=>c.id===p.circleId);if(!c)throw Error('Demo Circle unavailable.');
   if(operation==='circles.read')return {...copy(detail),circle:copy(c)};
   if(operation==='circles.invite'){const i={id:`demo-invite-${++sequence}`,token:'demo-invite',expires_at:'2026-10-22T12:00:00Z'};detail.invites.push(i);result={inviteId:i.id,token:i.token};}
   else if(operation==='circles.revoke_invite'){detail.invites=detail.invites.filter(i=>i.id!==p.inviteId);result={revoked:true};}
   else if(operation==='circles.policy'){detail.policy=copy(p.allowedTypes);result={allowedTypes:detail.policy};}
   else if(operation==='circles.remove'){detail.members=detail.members.filter(m=>m.id!==p.memberId);result={removed:true};}
   else if(operation==='circles.leave'){circles.splice(circles.indexOf(c),1);result={left:true};}
   else if(operation==='knowledge.search'){
    const query=(p.query||'').toLowerCase();let rows=posts.filter(a=>a.circleId===p.circleId&&!a.parentId&&readable(a)&&(!query||`${a.content.title} ${a.content.body} ${a.content.company||''}`.toLowerCase().includes(query))&&['company','role','type','stage'].every(k=>!p[k]||a.content[k]?.toLowerCase()===p[k].toLowerCase())&&(!p.since||a.content.experienceDate>=p.since)&&(!p.until||a.content.experienceDate&&a.content.experienceDate<=p.until)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    if(p.cursor)rows=rows.slice(rows.findIndex(a=>a.id===p.cursor.id)+1);const items=rows.slice(0,p.limit||20).map(project);return {items,nextCursor:rows.length>items.length?{id:items.at(-1).id}:null};
   } else if(operation==='knowledge.citations')return {items:copy(receipts.map(r=>({...r,source_available:readable(posts.find(a=>a.id===r.post_id))}))),nextCursor:null};
   else if(operation==='knowledge.propose'){
    let post=posts.find(a=>a.id===p.postId);
    if(post){if(!post.owned||post.revision!==p.expectedRevision)throw Error('Post changed; reload.');post.revision++;post.content=copy(p.content);post.helpfulPeople=0;post.approved=false;}
    else {post={id:`demo-post-${++sequence}`,circleId:p.circleId,parentId:p.parentId||null,revision:1,publishedRevision:null,state:'draft',owned:true,author:'Taylor (demo)',createdAt:new Date().toISOString(),helpfulPeople:0,agentAuthored:false,approved:false,untrusted:true,content:copy(p.content)};posts.push(post);}
    result={postId:post.id,revision:post.revision};
   } else {
    const post=posts.find(a=>a.id===p.postId&&a.circleId===p.circleId);
    if(operation==='knowledge.retract'){for(const receipt of receipts)if(receipt.post_id===p.postId&&receipt.revision===p.revision&&!receipt.retracted_at){receipt.retracted_at=new Date().toISOString();if(post?.revision===p.revision)post.helpfulPeople=Math.max(0,post.helpfulPeople-1);}result={retracted:true};}
    else {
     if(!readable(post))throw Error('Post unavailable.');
     if(operation==='knowledge.read')return {post:project(post),replies:posts.filter(a=>a.parentId===post.id&&readable(a)).map(project),nextCursor:null};
     if(['knowledge.approve','knowledge.publish','knowledge.withdraw'].includes(operation)&&(!post.owned||post.revision!==p.expectedRevision))throw Error('Owned current revision required.');
     if(operation==='knowledge.approve')post.approved=true;
     else if(operation==='knowledge.publish'){post.state='published';post.publishedRevision=post.revision;}
     else if(operation==='knowledge.withdraw')post.state='withdrawn';
     else if(operation==='knowledge.report')detail.reports.push({id:`demo-report-${++sequence}`,postId:post.id,reason:p.reason});
     else if(operation==='knowledge.hide'){post.state='hidden';detail.reports=detail.reports.filter(r=>r.postId!==post.id);}
     else throw Error('Unsupported fictional demo operation.');
     result={postId:post.id,revision:post.revision};
    }
   }
  }
  if(p.eventKey)requests.set(p.eventKey,{operation,payload:copy(p),result:copy(result)});return copy(result);
 }
 return {action};
}
