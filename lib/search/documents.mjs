import {load,JSON_SCHEMA} from 'js-yaml';
import {filterFields,priorities} from '../search-profile.mjs';
function yaml(text) {try{return load(text,{schema:JSON_SCHEMA});}catch(error){throw Error(error.reason==='duplicated mapping key'?'Invalid YAML: duplicated field.':'Invalid YAML. Check indentation, quoting and the example in the tool schema.');}}
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
  projection=yaml(m[1]);body=m[2];
 } else if(kind==='portals')projection=yaml(content);
 else throw Error('Unknown document kind.');
 if(!projection||typeof projection!=='object'||Array.isArray(projection))throw Error('Document settings must be an object.');
 if(kind==='profile') {
  if(Object.keys(projection).some(k=>!['id','name','active','filters','priorities'].includes(k)))throw Error('Profile frontmatter accepts id, name, active, filters, priorities. Put narrative below it.');
  if(!/^[\w-]{1,80}$/.test(projection.id||'')||typeof projection.name!=='string'||!projection.name.trim()||projection.name.length>80||typeof projection.active!=='boolean')throw Error('Profile needs an ID, name, and active flag.');
  for(const key of ['filters','priorities'])if(!projection[key]||typeof projection[key]!=='object'||Array.isArray(projection[key]))throw Error('Filters and priorities must be objects.');
  if(Object.entries(projection.filters).some(([k,v])=>!Object.hasOwn(filterFields,k)||typeof v!=='string'||v.length>500))throw Error('Profile filters use string values under Employment, Work arrangement, Location, Minimum base pay, Schedule or Experience level. Put other targeting in the narrative.');
  if(Object.entries(projection.priorities).some(([k,v])=>!priorities.includes(k)||!['Important','Very important'].includes(v)))throw Error('Profile priorities use Important or Very important under Pay, Stability, Flexibility, Growth, Meaningful work, Team quality or Getting employed quickly.');
  if(body.length>20000)throw Error('Targeting narrative is limited to 20,000 characters.');
  return {content:profileDocument({...projection,instructions:body}),projection:{...projection,instructions:body}};
 }
 const allowed=['tracked_companies','search_queries','title_filter','location_filter'];
 if(Object.keys(projection).some(k=>!allowed.includes(k)))throw Error('Portals accepts tracked_companies, search_queries, title_filter, location_filter.');
 if(!Array.isArray(projection.tracked_companies)||!Array.isArray(projection.search_queries))throw Error('Portals needs tracked_companies and search_queries arrays.');
 if(projection.tracked_companies.length>100||projection.search_queries.length>100||projection.search_queries.some(q=>typeof q!=='string'||!q.trim()||q.length>2000))throw Error('Portals accepts up to 100 sources and 100 nonempty search query strings.');
 const sourceFields=['id','name','kind','careers_url','enabled','provider','api','keywords'];
 for(const s of projection.tracked_companies){
  if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!sourceFields.includes(k))||!/^[\w-]{1,80}$/.test(s.id||'')||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||!['board','careers','social'].includes(s.kind)||typeof s.enabled!=='boolean'||typeof s.careers_url!=='string'||s.careers_url.length>2048||!(/^https:\/\/[^\s/]+[^\s]*$/.test(s.careers_url)||s.kind==='social'&&/^@[\w.]{1,80}$/.test(s.careers_url)))throw Error('Each portal needs id, name, kind (board/careers/social), careers_url (HTTPS or a social @handle), and enabled (boolean).');
  if(s.provider!==undefined&&(typeof s.provider!=='string'||s.provider.length>100)||s.api!==undefined&&(typeof s.api!=='string'||s.api.length>2048||!s.api.startsWith('https://'))||s.keywords!==undefined&&(!Array.isArray(s.keywords)||s.keywords.length>20||s.keywords.some(k=>typeof k!=='string')))throw Error('Portal provider/api/keywords must be a bounded provider string, HTTPS API URL and keyword string array.');
 }
 if(new Set(projection.tracked_companies.map(s=>s.id)).size!==projection.tracked_companies.length)throw Error('Portal source IDs must be unique.');
 const arrayOfText=a=>Array.isArray(a)&&a.every(v=>typeof v==='string'&&v.length<=200);
 if(projection.title_filter!==undefined&&(!projection.title_filter||typeof projection.title_filter!=='object'||Array.isArray(projection.title_filter)||Object.entries(projection.title_filter).some(([k,v])=>!['positive','negative'].includes(k)||!arrayOfText(v))))throw Error('title_filter accepts positive and negative arrays of strings.');
 if(projection.location_filter!==undefined&&(!projection.location_filter||typeof projection.location_filter!=='object'||Array.isArray(projection.location_filter)||Object.keys(projection.location_filter).some(k=>!['allow','strict'].includes(k))||projection.location_filter.allow!==undefined&&!arrayOfText(projection.location_filter.allow)||projection.location_filter.strict!==undefined&&typeof projection.location_filter.strict!=='boolean'))throw Error('location_filter accepts allow (string array) and strict (boolean).');
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
