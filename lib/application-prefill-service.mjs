import {applicationHandoff,mergeApplicationAnswerUpdates} from './application-handoff.mjs';
import {prefillApplicationQuestions} from './application-prefill.mjs';
import {selectResume} from '../supabase/functions/agent-gateway/resume-selection.mjs';
// Existing prepare_draft boundary; ownership/revision/approval remain SQL-owned.
export async function prepareDraftWithPrefill(call,payload,{loadJob,loadApplication}){
 const context=await call('context.personal',{});if(context.error)return context;
 const {settings,personalVersion}=context.data,job=await loadJob(payload.jobId);if(!job)return {error:{code:'P0002'}};
 const userId=settings.profile?.user_id,existing=loadApplication?await loadApplication(payload.jobId,userId):null;
 if(existing&&existing.revision!==payload.expectedRevision)return {error:{code:'40001'}};
 const searchProfileId=payload.draft.searchProfileId||existing?.draft?.searchProfileId;
 let searchProfile,searchProfileVersion;
 if(searchProfileId){const search=await call('search.context',{profileId:searchProfileId});if(search.error)return search;const document=search.data.documents?.find(d=>d.kind==='profile'&&d.id===searchProfileId);if(!document||document.projection?.active===false)return {error:{code:'P0002'}};searchProfile={...document.projection,id:searchProfileId};searchProfileVersion=document.version;}
 const {answerUpdates,...draftFields}=payload.draft;
 let inputQuestions=payload.draft.questions||[];
 if(answerUpdates!==undefined){if(!existing||payload.draft.questions!==undefined)return {error:{code:'22023'}};try{inputQuestions=mergeApplicationAnswerUpdates(existing.draft.questions||[],answerUpdates);}catch{return {error:{code:'22023'}};}}
 const explicitResume=payload.draft.resumeId||existing?.draft?.resumeId;
 const choice=explicitResume?{resumeId:explicitResume}:userId?selectResume({userId,job:job.employer,resumes:settings.resumes||[],preferences:settings.preferences?.search||{}}):{};
 if(choice.resumeId&&!(settings.resumes||[]).some(r=>r.id===choice.resumeId&&r.user_id===userId))return {error:{code:'P0002'}};
 let result;try{result=prefillApplicationQuestions({questions:inputQuestions,profile:settings.profile||{},answers:settings.answers||[],resumes:settings.resumes||[],resumeId:choice.resumeId,company:job.employer?.company,userId,existingQuestions:answerUpdates?[]:existing?.draft?.questions||[],searchProfile,searchProfileVersion});}catch{return {error:{code:'22023',message:'Employer fields are malformed or ambiguous.'}};}
 const versions=await call('context.versions',{});if(versions.error)return versions;
 if(versions.data.personalVersion!==personalVersion)return {error:{code:'40001'}};
 if(searchProfileId){const latest=await call('search.context',{profileId:searchProfileId});if(latest.error)return latest;if(latest.data.documents?.find(d=>d.kind==='profile'&&d.id===searchProfileId)?.version!==searchProfileVersion)return {error:{code:'40001'}};}
 const {questions,questionsReviewed,resumeId,...report}=result;
 const {responseMode,...writePayload}=payload;
 const saved=await call('drafts.prepare',{...writePayload,blocker:payload.blocker===undefined?existing?.blocker:payload.blocker,draft:{...existing?.draft,...draftFields,questions,questionsReviewed:false,...(resumeId?{resumeId}:{})}});
 if(saved.error)return saved;
 const handoff=applicationHandoff({result,job,profile:settings.profile,personalVersion,searchProfileId,searchProfileVersion});
 if(responseMode==='full')return {data:{...saved.data,prefill:{...report,personalVersion},handoff},error:null};
 return {data:{id:saved.data.id,job_id:saved.data.job_id||payload.jobId,revision:saved.data.revision,status:saved.data.status,blocker:saved.data.blocker||null,questionsReviewed:saved.data.draft?.questionsReviewed===true,prefill:{counts:result.counts,personalVersion,searchProfileId:searchProfileId||null,searchProfileVersion:searchProfileVersion??null},handoff},error:null};
}
