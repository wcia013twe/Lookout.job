const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const rows={type:'array',minItems:1,maxItems:500,items:{type:'object'}};
export const IMPORT_TOOLS=[
 {name:'list_imported_jobs',operation:'imports.list',scope:'workspace:read',readOnly:true,description:'Read all private Simplify tracker history and its version. Imported submissions are user-reported, never verified receipts. Records without URLs are retained privately.',inputSchema:object({})},
 {name:'preview_simplify_import',operation:'imports.preview',scope:'tracking:write',readOnly:true,description:'Preview Simplify tracked-jobs rows without saving. Each row: company,title,location,url (HTTP(S) or null),status SAVED/APPLIED,employmentType FT/Internship,appliedDate/statusDate/archivedDate (YYYY-MM-DD or null),archived boolean,notes. Parse the actual export; never invent missing URLs or dates. Returns version and duplicate/conflict decisions. Retains source rows and preserves existing statuses.',inputSchema:object({rows},['rows'])},
 {name:'import_simplify_jobs',operation:'imports.save',scope:'tracking:write',description:'Import the exact reviewed Simplify rows after the user requests import. Use preview version as expectedVersion and a stable eventKey. Same rows as preview_simplify_import. Existing records/statuses are preserved; imported history stays private and grants no approval, verified submission, or automation permission. Reuse eventKey only for identical payload retries.',inputSchema:object({rows,expectedVersion:{type:'integer',minimum:0},eventKey:{type:'string',maxLength:160}},['rows','expectedVersion','eventKey'])},
];
export function validateImport(operation,p){
 const t=IMPORT_TOOLS.find(t=>t.operation===operation);if(!t)return;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!Object.hasOwn(t.inputSchema.properties,k))||t.inputSchema.required.some(k=>p[k]===undefined))throw Error('Invalid Simplify import arguments');
 if(operation!=='imports.list'&&(!Array.isArray(p.rows)||!p.rows.length||p.rows.length>500||JSON.stringify(p).length>240000))throw Error('Import needs 1–500 bounded Simplify rows');
 if(operation==='imports.save'&&(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<0||!/^[-\w:.]{1,160}$/.test(p.eventKey||'')))throw Error('Current import version and stable event key required');
}
