const key='lookout:onboarding-after-signin';
// Fixed same-origin destination only; no credentials, private facts or arbitrary return URL.
export function rememberOnboardingReturn(storage,path) {
 if(/\/onboarding\/?$/.test(path))storage.setItem(key,'onboarding');
}
export function takeOnboardingReturn(storage,{signedIn,path}) {
 if(!signedIn||storage.getItem(key)!=='onboarding')return false;
 storage.removeItem(key);
 return !/\/onboarding\/?$/.test(path);
}
