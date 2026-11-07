import {EXTRA_FEATURES_ENABLED} from "../../lib/feature-scope.mjs";
// Browser-only navigation checkpoint. Never evidence of connection or completion.
export const setupSteps = ['start','preferences','first-role','connect','circles','done'].filter(step => EXTRA_FEATURES_ENABLED || step !== 'circles');
export function onboardingProgressKey(owner) {
 return owner ? `lookout:onboarding-progress:v1:${owner}` : null;
}
export function readOnboardingProgress(storage, key) {
 try {
  const scene=key && storage.getItem(key);
  return scene === 'circles' && !EXTRA_FEATURES_ENABLED ? 'done' : setupSteps.includes(scene) ? scene : 'start';
 } catch { return 'start'; }
}
export function saveOnboardingProgress(storage,key,scene) {
 try {
  if(!key)return false;
  // The reveal holds transient role data; resume at its preview entry instead.
  storage.setItem(key,scene==='reveal'?'first-role':scene);
  return true;
 } catch { return false; }
}
export function clearOnboardingProgress(storage,key) {
 try { if(key)storage.removeItem(key); } catch { /* Setup still works without storage. */ }
}
export function onboardingStorage() {
 try { return window.localStorage; } catch { return null; }
}
