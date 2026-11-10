// The publication tool and gateway use the same public posting contract.
const text=maxLength=>({type:'string',maxLength});
const date={type:['string','null'],pattern:'^\\d{4}-\\d{2}-\\d{2}$',description:'YYYY-MM-DD, or null when the source does not disclose a date. Never invent dates.'};
export const discoverEmployerSchema={type:'object',additionalProperties:false,required:['company','title','employmentType','location'],properties:{
 company:{...text(200),minLength:1},title:{...text(200),minLength:1},
 employmentType:{type:'string',enum:['FT','Internship'],description:'Use FT for full-time roles and Internship for internships. Do not send display labels such as Full-time.'},
 location:{...text(1000),description:'Employer location text; empty string if unknown.'},
 locations:{type:'array',maxItems:100,items:text(1000)},
 category:text(200),postedDate:date,discoveredDate:date,deadline:date,
 description:{...text(60000),description:'Ignored at publication: the latest owned saved job description is copied instead.'},
 compensation:text(2000),source:text(2048),sourceFreshness:text(4000),applicationUrl:{...text(2048),pattern:'^https://'},eligibility:text(4000),
}};
export function normalizeEmploymentType(value){
 if(typeof value!=='string')return null;
 const key=value.trim().toLowerCase();
 return ['ft','full-time','full time','full_time'].includes(key)?'FT':key==='internship'?'Internship':null;
}
export function validateDiscoverEmployer(employer){
 if(!employer||typeof employer!=='object'||Array.isArray(employer))throw Error('employer must be an object of public posting facts.');
 const value={...employer};
 for(const key of discoverEmployerSchema.required)if(!Object.hasOwn(value,key))throw Error(`employer.${key} is required; employmentType must be FT or Internship, location may be empty when unknown.`);
 value.employmentType=normalizeEmploymentType(value.employmentType);
 if(!value.employmentType)throw Error('employer.employmentType must be FT or Internship; verify the posting rather than guessing.');
 for(const [key,input] of Object.entries(value)){
  const field=discoverEmployerSchema.properties[key];
  if(!field)throw Error(`Unknown employer.${key}; private fit belongs in recommendation.`);
  if(field.type==='array'){
   if(!Array.isArray(input)||input.length>field.maxItems||input.some(v=>typeof v!=='string'||v.length>field.items.maxLength))throw Error(`employer.${key} must be a bounded array of strings.`);
  }else if(Array.isArray(field.type)){
   if(input!==null&&(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input)||!Number.isFinite(Date.parse(input))||new Date(input).toISOString().slice(0,10)!==input))throw Error(`employer.${key} must be YYYY-MM-DD or null.`);
  }else if(typeof input!=='string'||input.length>(field.maxLength??200)||field.minLength&&!input.trim()||field.pattern&&!new RegExp(field.pattern).test(input))throw Error(`Invalid employer.${key}; use the published field type and bounds.`);
 }
 return value;
}
