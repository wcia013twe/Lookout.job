import {SINGLE_PROFILE_UI} from './single-profile.mjs';
// Temporarily paused for the assignment. Keep implementations and saved data intact.
// Circles is active; the remaining extra sections and tools stay paused.
export const EXTRA_FEATURES_ENABLED = false;

export function enabledMcpOperation(operation) {
  return (EXTRA_FEATURES_ENABLED || !/^(leaderboard\.|preferences\.theme\.save$)/.test(operation))
    && (!SINGLE_PROFILE_UI || operation !== 'preferences.tiers.save');
}

export function pausedFrontendRoute(path) {
  return !EXTRA_FEATURES_ENABLED && /^\/(themes|progress)(\/|$)/.test(path);
}
