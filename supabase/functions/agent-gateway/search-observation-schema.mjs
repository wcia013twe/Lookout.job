// Shared MCP discovery and gateway validation; SQL still owns authorization,
// source membership, concurrency, replay and transactional persistence.
const text=(maxLength,minLength=0)=>({type:'string',minLength,maxLength});
const nullable=schema=>({...schema,type:[schema.type,'null']});
const timestamp={type:'string',description:'ISO date or timestamp with timezone; use null only where allowed.'};
export const observationSchema={type:'object',additionalProperties:false,properties:{
 sourceId:{type:'string',minLength:1,description:'Exact source_id from read_search_run (portal:* or query:*), not a board name or URL.'},
 url:{...text(2048,1),pattern:'^https://[^\\s/]+[^\\s]*$',description:'Observed employer/ATS HTTPS URL.'},
 company:{...text(200,1),pattern:'\\S'},title:{...text(500,1),pattern:'\\S'},
 location:nullable(text(500)),checkedAt:{...timestamp,description:'Actual observation time; no more than five minutes in the future.'},
 liveness:{type:'string',enum:['active','expired','uncertain']},evidence:{...text(5000,1),pattern:'\\S'},
 employerPostedAt:nullable(timestamp),sourceListAgeDays:{type:['integer','null'],minimum:0,maximum:2147483647},
 description:nullable(text(60000)),atsIdentity:nullable({type:'string',maxLength:2196}),requisitionId:nullable({type:'string'}),employmentType:nullable({type:'string'}),
},required:['sourceId','url','company','title','location','checkedAt','liveness','evidence','employerPostedAt','sourceListAgeDays','description']};
export const countsSchema={type:'object',additionalProperties:{type:'integer',minimum:0,maximum:999999999},description:'Named nonnegative integer counters, e.g. {"found":1,"checked":2}; not strings, arrays, fractions or nested objects.'};
export const coverageSchema={type:'string',enum:['unknown','exhaustive','truncated','inaccessible']};

// Error paths contain only schema-owned field names and numeric array indexes.
// Never reflect supplied values or unknown property names into diagnostics.
export function validateObservationValue(value,schema,path){
 const fail=message=>{throw Error(`${path}: ${message}`);};
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(!types.includes(type)&&!(type==='number'&&types.includes('integer')&&Number.isSafeInteger(value)))fail(`expected ${types.join(' or ')}`);
 if(value===null)return;
 if(schema.enum&&!schema.enum.includes(value))fail(`expected ${schema.enum.join(', ')}`);
 if(type==='string'){
  const length=[...value].length;
  if(length<(schema.minLength??0)||length>(schema.maxLength??Infinity))fail(`length must be ${schema.minLength??0}–${schema.maxLength??'unbounded'}`);
  if(schema.pattern&&!new RegExp(schema.pattern).test(value))fail(path.endsWith('.url')?'expected an HTTPS URL without whitespace':'must contain non-whitespace text');
 }
 if(type==='number'&&(value<schema.minimum||value>schema.maximum))fail(`expected an integer from ${schema.minimum} to ${schema.maximum}`);
 if(type==='object'){
  for(const key of schema.required??[])if(!Object.hasOwn(value,key))throw Error(`${path}.${key}: required (use null if unknown where allowed)`);
  for(const [key,item]of Object.entries(value)){
   if(Object.hasOwn(schema.properties??{},key))validateObservationValue(item,schema.properties[key],`${path}.${key}`);
   else if(schema.additionalProperties===false)fail(`unsupported field; allowed fields: ${Object.keys(schema.properties).join(', ')}`);
   else if(typeof schema.additionalProperties==='object')validateObservationValue(item,schema.additionalProperties,`${path} values`);
  }
 }
}
export function validateObservations(listings){
 if(listings.length<1||listings.length>25)throw Error('listings: expected 1–25 observations');
 listings.forEach((listing,index)=>{
  const path=`listings[${index}]`;
  validateObservationValue(listing,observationSchema,path);
  for(const key of ['checkedAt','employerPostedAt']){
   if(listing[key]===null)continue;
   if(!Number.isFinite(Date.parse(listing[key])))throw Error(`${path}.${key}: expected a valid date or timestamp`);
  }
  if(Date.parse(listing.checkedAt)>Date.now()+300000)throw Error(`${path}.checkedAt: must not be more than five minutes in the future`);
 });
}
