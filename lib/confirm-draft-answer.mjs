import {mergeApplicationAnswerUpdates} from './application-handoff.mjs';
// Same field validation as MCP answerUpdates; existing cloud save owns SQL
// ownership/revision checks. Confirmation here saves an answer, never approval.
export async function confirmDraftAnswer({store,model,save,isCurrent,jobId,fieldId,answer,expectedRevision}){
 if(!isCurrent())throw Error('Account changed. Reopen this application.');
 const current=store.get('workflow.applications')?.[jobId];
 if(!current||!model.canEdit(current))throw Error('This application cannot be edited.');
 if((current.backendRevision??current.revision)!==expectedRevision)throw Error('Application changed. Reopen it before confirming your answer.');
 if(typeof answer!=='string'||!answer.trim())throw Error('Enter an answer first.');
 const questions=mergeApplicationAnswerUpdates(current.questions,[{fieldId,answer:answer.trim()}]);
 const next=model.edit(current,{questions,questionsReviewed:false});
 store.update('workflow.applications',apps=>({...apps,[jobId]:next}));
 await save();
 if(!isCurrent())throw Error('Account changed. Check the saved draft after signing in again.');
 const saved=store.get('workflow.applications')?.[jobId];
 if(saved?.questions?.find(q=>(q.fieldId||q.id)===fieldId)?.answer!==answer.trim())throw Error('Your answer could not be confirmed. Reopen the draft and try again.');
 return saved;
}
