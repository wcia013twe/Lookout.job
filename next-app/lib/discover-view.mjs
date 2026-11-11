import {roleApplied,roleRejected} from "../../lib/discover-application-state.mjs";
import {readField, promptFromProfile} from "../../lib/search-profile.mjs";

// Public browsing remains available; a signed-in workspace starts with agent-owned finds.
export function showAgentEmptyState({signedIn,hasPrivateBatch,demo,demoArrival}) {
 return demo ? Boolean(demoArrival) : Boolean(signedIn&&!hasPrivateBatch);
}

// A board follows the profile’s explicit employment preference, never its name.
export function matchesProfileEmployment(role, profile) {
 const preference=readField(profile.prompt ?? promptFromProfile(profile),"Search Filters","Employment").value;
 const normalize=value=>String(value).trim().toLowerCase().replace(/[\s-]+/g,"").replace(/^ft$/, "fulltime").replace(/^internships$/, "internship");
 const types=preference.split(/[,;/]|\s+(?:or|and)\s+/i).map(normalize).filter(Boolean);
 return !types.length || types.some(type=>["any","all","opentooptions"].includes(type)) || types.includes(normalize(role.employmentType));
}

export function matchesDiscoveryStatus(role,{applications={},trackerItems={},includeApplied=false}={}) {
 return !roleRejected(role,applications,trackerItems)&&(includeApplied||!roleApplied(role,applications,trackerItems));
}

// Visibility overrides are personal board preferences; absent overrides use the latest drop.
export function discoveryIsHidden(role, latestDate, overrides={}) {
 if (role.postingObservation?.liveness === 'expired') return true;
 const override=overrides[role.id];
 if (override === 'hidden') return true;
 if (override === 'visible') return false;
 if (role.priority === 'Apply Now' || role.priority === 'Strong Consider') return false;
 const recommended=role.lastRecommendedDate || role.discoveredDate;
 return Boolean(latestDate && recommended && recommended < latestDate);
}
