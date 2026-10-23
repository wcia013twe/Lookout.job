import {onboardingConnectionReady} from './onboarding-connection.mjs';
// Read-only website check. Automation registration belongs to the connected runtime.
export async function checkOnboardingConnection(api,isCurrent=()=>true){
 const session=await api.onboardingAction('onboarding.get_state');
 if(!isCurrent())return {status:'cancelled',session};
 return {status:onboardingConnectionReady(session)?'connected':'waiting',session};
}
