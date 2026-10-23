import type {Post} from '../_lib/types';

export default function AuthorshipLabel({post}:{post:Pick<Post,'agentAuthored'>}) {
 const known=typeof post.agentAuthored==='boolean';
 const label=!known?'Origin unknown':post.agentAuthored?'AI-drafted':'Human-posted';
 const explanation=!known?'Lookout has no recorded authoring origin for this contribution.':post.agentAuthored?'Drafted through an agent. This describes writing origin, not whether the experience is verified.':'Posted through the human interface. Lookout cannot determine whether AI helped write the text.';
 return <span className="inline-flex shrink-0 items-center rounded-md bg-board-tag px-2 py-0.5 text-xs font-medium leading-5 text-board-text" title={explanation} aria-label={`${label}. ${explanation}`}>{label}</span>;
}
