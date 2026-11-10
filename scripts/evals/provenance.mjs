// Structural provenance only. Never spread arbitrary review/runtime objects into exports.
const strings=new Set(['evaluationId','caseId','conditionOrder','participantModel','participantReasoning','graderModel','graderReasoning','participantFreezeDigest','graderFreezeDigest','graderEvidenceDigest','graderReceiptDigest','failureStatus','repairStatus','confoundStatus','usageCoverage','exporterSourceDigest']);
const booleans=new Set(['timingValid']);
export function exportProvenance(value){
 if(value==null)return {};
 if(typeof value!=='object'||Array.isArray(value))throw Error('Invalid structural provenance');
 const result={};
 for(const [key,v] of Object.entries(value)){
  if(strings.has(key)){
   if(v!==null&&(typeof v!=='string'||v.length<1||v.length>160||!/^[A-Za-z0-9_.:,/-]+$/.test(v)))throw Error('Invalid provenance '+key);
  }else if(booleans.has(key)){
   if(v!==null&&typeof v!=='boolean')throw Error('Invalid provenance '+key);
  }else throw Error('Unsupported provenance field '+key);
  result[key]=v;
 }
 return result;
}
