// References stay in the existing message body; no private account snapshots.
const identifier=/^[a-zA-Z0-9_-]+$/;
export function forumMentionCandidates(posts,query='') {
 const search=query.trim().toLowerCase();
 return posts.filter(post=>!post.parentId&&post.state==='published'&&post.revision===post.publishedRevision&&post.content.type!=='discussion'&&identifier.test(post.id)&&identifier.test(post.circleId)&&`${post.content.title} ${post.content.company||''} ${post.author}`.toLowerCase().includes(search)).slice(0,12);
}
export function forumMentionAt(text,cursor) {
 const prefix=text.slice(0,cursor),match=prefix.match(/(?:^|\s)@([^@\n]*)$/);
 return match?{start:prefix.lastIndexOf('@'),end:cursor,query:match[1]}:null;
}
export function formatForumMention(post) {
 if(!forumMentionCandidates([post]).length)throw Error('Choose a published forum post.');
 const label=post.content.title.replace(/[\[\]\r\n]/g,' ').trim().slice(0,200)||'Forum post';
 return `[@${label}](?circle=${post.circleId}&thread=${post.id})`;
}
export function parseForumMentions(text='') {
 const parts=[],pattern=/\[(@[^\]\n]{1,201})\]\(\?circle=([a-zA-Z0-9_-]+)&thread=([a-zA-Z0-9_-]+)\)/g;
 let end=0;
 for(const match of text.matchAll(pattern)) {
  if(match.index>end)parts.push({text:text.slice(end,match.index)});
  parts.push({text:match[1],circleId:match[2],postId:match[3]});end=match.index+match[0].length;
 }
 if(end<text.length)parts.push({text:text.slice(end)});
 return parts;
}
