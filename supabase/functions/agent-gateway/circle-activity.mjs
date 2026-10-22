// Activity belongs to the reviewed contribution revision, never the private tracker.
export function validateCircleActivity(activity) {
 if(!activity||typeof activity!=='object'||Array.isArray(activity)||Object.keys(activity).some(key=>!['highlights','goal','help'].includes(key)))throw Error('Invalid Circle activity.');
 if(!Array.isArray(activity.highlights)||activity.highlights.length>3||activity.highlights.some(value=>typeof value!=='string'||!value.trim()||value.length>300))throw Error('Use up to three activity highlights, each up to 300 characters.');
 for(const key of ['goal','help'])if(typeof activity[key]!=='string'||activity[key].length>300)throw Error('Activity goal and help must be text, up to 300 characters.');
 if(!activity.highlights.length&&!activity.goal.trim()&&!activity.help.trim())throw Error('Add a highlight, goal or help request.');
}
