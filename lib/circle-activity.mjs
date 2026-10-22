// Activity is member-authored, published Circle text, never private tracker data.
// Plain-text sections preserve the existing website/MCP contribution contract.
const labels = ['Recent activity:', "This week's goal:", 'Could use a hand with:'];
const line = value => String(value || '').replace(/\s+/g, ' ').trim();
/** @param {{highlights?: string[], goal?: string, help?: string}} [activity] */
export function formatCircleActivity({highlights = [], goal = '', help = ''} = {}) {
 const items = highlights.map(line).filter(Boolean).slice(0, 3);
 return [items.length ? `${labels[0]}\n${items.map(item => `- ${item}`).join('\n')}` : '', goal.trim() ? `${labels[1]}\n${line(goal)}` : '', help.trim() ? `${labels[2]}\n${line(help)}` : ''].filter(Boolean).join('\n\n');
}
export function parseCircleActivity(body = '') {
 const result = {message: '', highlights: [], goal: '', help: ''};
 const message = [];
 for (const block of body.split(/\n\s*\n/)) {
  const [heading, ...rest] = block.split('\n');
  const text = rest.join('\n').trim();
  if (heading === labels[0]) result.highlights = rest.filter(item => item.startsWith('- ')).map(item => line(item.slice(2))).filter(Boolean).slice(0, 3);
  else if (heading === labels[1]) result.goal = line(text);
  else if (heading === labels[2]) result.help = line(text);
  else message.push(block);
 }
 result.message = message.join('\n\n').trim();
 return result;
}
// Prefer structured fields for new revisions; old reviewed text stays untouched.
export function circleActivity(content = {}) {
 const legacy = parseCircleActivity(content.body);
 return content.activity ? {...legacy, ...content.activity, highlights: [...content.activity.highlights]} : legacy;
}
export function sharedMemberActivity(posts, authorId) {
 return posts.filter(post => post.authorId === authorId && !post.parentId && post.state === 'published' && post.revision === post.publishedRevision)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

// A stated completed/target pair is required for a determinate progress bar.
export function activityGoalProgress(goal = '') {
 const match = goal.trim().match(/^(\d+)\s+(?:of|\/)\s*(\d+)\s+(.+?)\s+(?:complete(?:d)?|done|finished)[.!]?$/i);
 if (!match) return null;
 const completed = Number(match[1]), target = Number(match[2]);
 if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(target) || target <= 0 || completed > target) return null;
 return {completed, target, label: match[3], percent: Math.round(completed / target * 100)};
}
