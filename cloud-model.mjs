export const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
export function draftPayload(application) {
  return {resumeId:application.resumeId,questions:application.questions,questionsReviewed:application.questionsReviewed,
    company:application.company,title:application.title,employmentType:application.employmentType,location:application.location,url:application.url};
}
export function fromCloud(rows) {
  const p=rows.profiles[0],pref=rows.preferences[0];
  return {
    cloudDirty:false,deletedAnswerIds:[],
    profile:{name:'',email:'',phone:'',location:'',authorization:'',...(p?.facts || {}),verified:Boolean(p?.verified_at)},
    tierLists:pref?.tier_lists || [],activeTierListId:pref?.active_tier_list_id || '',
    savedAnswers:rows.answer_library.map(a=>({id:a.id,question:a.question,answer:a.answer,policy:a.autofill_policy,
      companyScope:a.company_scope || '',verifiedAt:a.verified_at,version:a.context?.version || 1,updatedAt:a.updated_at})),
    resumes:rows.resumes.map(r=>({id:r.id,name:r.name,url:r.reference_url || '',objectPath:r.object_path,version:r.version})),
    applications:Object.fromEntries(rows.applications.map(a=>[a.job_id,{
      resumeId:'',questions:[],questionsReviewed:false,...a.draft,id:a.job_id,backendId:a.id,backendRevision:a.revision,status:a.status,revision:a.revision,blocker:a.blocker || '',
      approved:a.status==='Approved' ? {revision:a.revision,at:a.updated_at} : null,
      activity:[{at:a.updated_at,text:`Account application: ${a.status}`}],
    }])),
  };
}
export function batchRoles(items,date) {
  return items.map(item=>({...(item.jobs?.employer || {}),id:item.job_id,applicationUrl:item.jobs?.canonical_url,
    discoveredDate:date,whyItFits:item.recommendation?.whyItFits || '',priority:item.recommendation?.priority || 'Strong Consider',
    category:item.recommendation?.category || '',sourceFreshness:'See employer listing',applicationStatus:'New'}));
}
