/** @typedef {'active'|'expired'|'uncertain'} PostingLiveness */
/** @typedef {'ats-api'|'browser'|'guard'|'budget'} LivenessMethod */
/** @typedef {{url:string,result:PostingLiveness,code:string,reason:string,checkedAt:string,method:LivenessMethod}} PostingLivenessResult */
export function assertPostingLiveness(value){
 if(!value||typeof value!=='object'||!['active','expired','uncertain'].includes(value.result)||typeof value.code!=='string'||!value.code||typeof value.reason!=='string'||!value.reason||typeof value.url!=='string'||!['ats-api','browser','guard','budget'].includes(value.method)||typeof value.checkedAt!=='string'||!Number.isFinite(Date.parse(value.checkedAt)))throw Error('Invalid copied Career Ops liveness result.');
 return value;
}
