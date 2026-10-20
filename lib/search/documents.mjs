import {load,JSON_SCHEMA} from 'js-yaml';
// Canonical serialization uses JSON-compatible YAML. SQL independently checks this
// representation, so neither browser nor agent can supply a forged projection.
export const profileDocument = p => `---\n${JSON.stringify({id:p.id,name:p.name,active:p.active,filters:p.filters||{},priorities:p.priorities||{}},null,2)}\n---\n${p.instructions||''}`;
export const portalsDocument = p => JSON.stringify(p,null,2);
/** @returns {{content:string, projection:Record<string, any>}} */
export function parseDocument(kind,content) {
 if(typeof content!=='string'||content.length>60000)throw Error('Document must be text, up to 60,000 characters.');
 if(kind==='rules')return {content,projection:{}};
 let projection,body='';
 if(kind==='profile') {
  const m=content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if(!m)throw Error('Use YAML frontmatter followed by your targeting narrative.');
  projection=load(m[1],{schema:JSON_SCHEMA});body=m[2];
 } else if(kind==='portals')projection=load(content,{schema:JSON_SCHEMA});
 else throw Error('Unknown document kind.');
 if(!projection||typeof projection!=='object'||Array.isArray(projection))throw Error('Document settings must be an object.');
 if(kind==='profile') {
  if(Object.keys(projection).some(k=>!['id','name','active','filters','priorities'].includes(k)))throw Error('Profile frontmatter accepts id, name, active, filters, priorities. Put narrative below it.');
  if(!/^[\w-]{1,80}$/.test(projection.id||'')||typeof projection.name!=='string'||!projection.name.trim()||projection.name.length>80||typeof projection.active!=='boolean')throw Error('Profile needs an ID, name, and active flag.');
  for(const key of ['filters','priorities'])if(!projection[key]||typeof projection[key]!=='object'||Array.isArray(projection[key]))throw Error('Filters and priorities must be objects.');
  if(body.length>20000)throw Error('Targeting narrative is limited to 20,000 characters.');
  return {content:profileDocument({...projection,instructions:body}),projection:{...projection,instructions:body}};
 }
 const allowed=['tracked_companies','search_queries','title_filter','location_filter'];
 if(Object.keys(projection).some(k=>!allowed.includes(k)))throw Error('Portals accepts tracked_companies, search_queries, title_filter, location_filter.');
 if(!Array.isArray(projection.tracked_companies)||!Array.isArray(projection.search_queries))throw Error('Portals needs tracked_companies and search_queries arrays.');
 return {content:portalsDocument(projection),projection};
}
export const sourceTemplates=[
 {id:'simplify-summer',name:'Simplify summer',kind:'board',careers_url:'https://github.com/SimplifyJobs/Summer2027-Internships',enabled:true},
 {id:'simplify-newgrad',name:'Simplify new-grad',kind:'board',careers_url:'https://github.com/SimplifyJobs/New-Grad-Positions',enabled:true},
 {id:'simplify-offseason',name:'Simplify off-season',kind:'board',careers_url:'https://github.com/SimplifyJobs/Summer2027-Internships/blob/dev/README-Off-Season.md',enabled:true},
];
export function compactBrief(document) {
 const p=document?.projection;
 if(!p)return '';
 const headings=(p.instructions||'').split('\n').filter(l=>/^#{1,3}\s/.test(l));
 return JSON.stringify({name:p.name,filters:p.filters,priorities:p.priorities,narrativeSections:headings,notice:'Read the selected profile’s complete rules and criteria before making decisions. Legacy shared rules are reference only. This brief omits prose and exceptions.'});
}
