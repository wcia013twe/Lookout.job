import {validateCompany} from './network-model.mjs';
const str={type:'string'},rev={type:'integer',minimum:0};
export const NETWORK_TOOLS=[
 {name:'read_network_companies',operation:'network.companies.read',scope:'workspace:read',readOnly:true,description:'Read private company research and priorities, source dates, follow-ups and explicit owned contact/application links. Page with offset/limit; no shared company database or live research.',inputSchema:{type:'object',properties:{offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
 {name:'save_network_company',operation:'network.company.save',scope:'network:write',description:'Create/update a private company record with current revision (0 for create). Read first, preserve user judgments and links. record fields: name,website,priority (Apply Now/Strong Consider/Skip Unless Team Fit),interest,targetTeams,concerns,research,nextAction,followUpDate (YYYY-MM-DD or empty),sources [{title,url,observedAt,summary}],contactIds,applicationIds,archived. Sources need HTTPS URLs and observed dates. Link only owned records. Archive only on user request. Never sends, researches automatically, or schedules notifications.',inputSchema:{type:'object',properties:{id:str,expectedRevision:rev,record:{type:'object'}},required:['id','expectedRevision','record'],additionalProperties:false}}
];
export function validateNetwork(operation,p){
 const tool=NETWORK_TOOLS.find(t=>t.operation===operation);if(!tool)return;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!Object.hasOwn(tool.inputSchema.properties,k)))throw Error('Invalid network arguments');
 if(operation==='network.companies.read'){if(p.offset!==undefined&&(!Number.isSafeInteger(p.offset)||p.offset<0)||p.limit!==undefined&&(!Number.isInteger(p.limit)||p.limit<1||p.limit>100))throw Error('Bounded company page required');}
 else {if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.id||'')||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)throw Error('Company ID and current revision required');validateCompany(p.record);}
}
