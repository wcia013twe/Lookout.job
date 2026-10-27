import {prefillApplicationQuestions} from './application-prefill.mjs';
import {selectResume} from '../supabase/functions/agent-gateway/resume-selection.mjs';
// Existing prepare_draft boundary; ownership/revision/approval remain SQL-owned.
export async function prepareDraftWithPrefill(call,payload,{loadJob,loadApplication}){
 const context=await call('context.personal',{});if(context.error)return context;
 const {settings,personalVersion}=context.data,job=await loadJob(payload.jobId);if(!job)return {error:{code:'P0002'}};
 const userId=settings.profile?.user_id,existing=loadApplication?await loadApplication(payload.jobId,userId):null;
 if(existing&&existing.revision!==payload.expectedRevision)return {error:{code:'40001'}};
 const explicitResume=payload.draft.resumeId||existing?.draft?.resumeId;
 const choice=explicitResume?{resumeId:explicitResume}:userId?selectResume({userId,job:job.employer,resumes:settings.resumes||[],preferences:settings.preferences?.search||{}}):{};
 if(choice.resumeId&&!(settings.resumes||[]).some(r=>r.id===choice.resumeId&&r.user_id===userId))return {error:{code:'P0002'}};
 let result;try{result=prefillApplicationQuestions({questions:payload.draft.questions||[],profile:settings.profile||{},answers:settings.answers||[],resumes:settings.resumes||[],resumeId:choice.resumeId,company:job.employer?.company,userId,existingQuestions:existing?.draft?.questions||[]});}catch{return {error:{code:'22023',message:'Employer fields are malformed or ambiguous.'}};}
 const versions=await call('context.versions',{});if(versions.error)return versions;
 if(versions.data.personalVersion!==personalVersion)return {error:{code:'40001'}};
 const {questions,questionsReviewed,resumeId,...report}=result;
 const saved=await call('drafts.prepare',{...payload,blocker:payload.blocker===undefined?existing?.blocker:payload.blocker,draft:{...existing?.draft,...payload.draft,questions,questionsReviewed:false,...(resumeId?{resumeId}:{})}});
 return saved.error?saved:{data:{...saved.data,prefill:{...report,personalVersion}},error:null};
}
