// Public browsing remains available; a signed-in workspace starts with agent-owned finds.
export function showAgentEmptyState({signedIn,hasPrivateBatch,demo,demoArrival}) {
 return demo ? Boolean(demoArrival) : Boolean(signedIn&&!hasPrivateBatch);
}
