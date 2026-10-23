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
