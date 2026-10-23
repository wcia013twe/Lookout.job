// Issuing or copying credentials is not evidence that a runtime checked in.
export function onboardingConnectionReady(session) {
 const check=session?.data?.connectionTest;
 if(check?.connectionId&&check?.checkedAt&&Number.isFinite(Date.parse(check.checkedAt)))return true;
 const runtime=session?.data?.runtime;
 return Boolean(runtime?.connectionId && runtime?.browsingReportedAt && Number.isFinite(Date.parse(runtime.browsingReportedAt)));
}
