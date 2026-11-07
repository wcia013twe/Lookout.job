// Temporarily paused for the assignment. Keep implementations and saved data intact.
// Restore these UI sections and MCP tools together by setting this to true.
export const EXTRA_FEATURES_ENABLED = false;

export function enabledMcpOperation(operation) {
  return EXTRA_FEATURES_ENABLED || !/^(circles\.|knowledge\.|leaderboard\.|preferences\.theme\.save$)/.test(operation);
}

export function pausedFrontendRoute(path) {
  return !EXTRA_FEATURES_ENABLED && /^\/(circles|themes|progress)(\/|$)/.test(path);
}
