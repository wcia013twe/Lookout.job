// Website completion never implies a connected agent, verified profile or approval.
export function websiteOnboardingComplete(session){
 return typeof session?.data?.websiteCompletedAt==='string' && Number.isFinite(Date.parse(session.data.websiteCompletedAt));
}
export function websiteOnboardingDestination({path,demo,authReady,signedIn,status}){
 if(demo||!authReady||/^\/(privacy|workspace-reset)\/?$/.test(path)||/^\/career-toolkit\/[^/]+\/?$/.test(path))return null;
 const onboarding=/^\/onboarding\/?$/.test(path);
 if(!signedIn)return null; // The existing signed-out sign-in screen owns guest access.
 if(status==='incomplete')return onboarding?null:'/onboarding/';
 if(status==='complete'&&onboarding)return '/?tour=dashboard';
 return null;
}
export async function finishWebsiteOnboarding(api){
 const state=await api.onboardingAction('onboarding.get_state');
 if(websiteOnboardingComplete(state))return state;
 return api.onboardingAction('onboarding.submit_step',{expectedRevision:state.revision,eventKey:`website-complete-${state.revision}`,event:'website_complete',data:{}});
}
