'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useWorkspace} from '../../../lib/workspace';
import {interviewingCompanies,companySpaces,companyTopics} from '../../../../lib/company-spaces.mjs';
import {CompanyLogo} from '../../../components/role-card';
import {Notice,secondary} from '../../../components/ui';
import ApiError from '../../../components/api-error';
import {types,type Post,type Cursor,type Request} from '../_lib/types';
import styles from './company-discussions.module.css';
type Page={items:Post[];nextCursor:Cursor|null};
type Space={key:string;company:string;role:string;stage:string;recommended:boolean;posts:Post[]};
function SearchIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;}
function Arrow(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;}
export default function CompanyDiscussions({request,openPost}:{request:Request;openPost:(post:Post)=>void}){
 const w=useWorkspace();
 const [query,setQuery]=useState(''),[company,setCompany]=useState(''),[input,setInput]=useState('');
 const [page,setPage]=useState<Page>({items:[],nextCursor:null}),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),identity=JSON.stringify([query,company]),latest=useRef(identity);latest.current=identity;
 const recommendations=interviewingCompanies({roles:w.roles||[],tracker:w.state?.tracker||{},applications:w.state?.workflow?.applications||{}});
 const spaces=companySpaces(page.items,query?[]:recommendations) as Space[];
 const recommended=spaces.filter(space=>space.recommended),explore=spaces.filter(space=>!space.recommended);
 async function load(more=false){
  const version=++generation.current,started=identity;setBusy(true);setError('');
  try{const result=await request<Page>('knowledge.search',{scope:'current_memberships',sort:'newest',limit:50,...(query?{query}:{}),...(company?{company}:{}),...(more?{cursor:page.nextCursor}:{})});
   if(version===generation.current&&latest.current===started)setPage(old=>({items:more?[...new Map([...old.items,...result.items].map(post=>[post.id,post])).values()]:result.items,nextCursor:result.nextCursor}));
  }catch(e){if(version===generation.current&&latest.current===started){setPage({items:[],nextCursor:null});setError(e instanceof Error?e.message:'Discussions could not load.');}}
  finally{if(version===generation.current&&latest.current===started)setBusy(false);}
 }
 useEffect(()=>{setPage({items:[],nextCursor:null});void load();return()=>{generation.current++;};},[request,identity]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();setCompany('');setQuery(input.trim());}
 function reset(){setInput('');setQuery('');setCompany('');}
 function openCompany(name:string){setCompany(name);setInput('');setQuery('');}
 return <section aria-labelledby="company-discussions-title" className={styles.root}>
  <header className={styles.intro}><h2 id="company-discussions-title">The conversations behind your next interview.</h2><p>Find the experiences, questions, and recruiting updates that help you take your next step.</p></header>
  <form role="search" aria-label="Search company discussions" className={styles.search} onSubmit={search}>
   <SearchIcon/><input aria-label="Search companies and discussions" value={input} onChange={event=>setInput(event.target.value)} maxLength={500} placeholder="Search companies, roles, or interview experiences…" type="search"/>
   <button type="submit" aria-label="Search" disabled={busy}><Arrow/></button>
  </form>
  <div className={styles.scope}><span>From your Circles · Only threads you can access</span>{w.demo&&<span>Fictional demo</span>}</div>
  <ApiError message={error} onRetry={()=>void load()}/>
  {error&&!page.items.length?null:busy&&!page.items.length?<div className={styles.loading} role="status" aria-label="Finding company discussions"><span>Finding relevant conversations…</span><div className={styles.grid}>{[0,1].map(key=><div className={styles.skeleton} key={key} aria-hidden="true"/>)}</div></div>:company?<section className={styles.companyThreads} aria-label={`${company} discussions`}>
   <button type="button" className={styles.back} onClick={reset}>Back to companies</button>
   <header className={styles.companyHeading}><CompanyLogo company={company}/><div><h3>{company}</h3><p>{recommendations.find(space=>space.company===company)?.role||'Shared experiences and conversations'}</p></div></header>
   <ThreadList posts={page.items} openPost={openPost}/>
   {!busy&&!error&&!page.items.length&&<div className={styles.empty}><h4>The conversation is still ahead.</h4><p>No shared threads about {company} in your Circles yet. You can start one inside a Circle.</p></div>}
  </section>:<>
   {query&&<div className={styles.sectionHeading}><div><h3>Results for “{query}”</h3><p>Companies mentioned in matching threads.</p></div><button type="button" className={styles.back} onClick={reset}>Clear search</button></div>}
   {!query&&!!recommended.length&&<section className={styles.section} aria-label="Where you’re interviewing"><div className={styles.sectionHeading}><div><h3>Where you’re interviewing</h3><p>A little context for the rounds ahead.</p></div><span>Based on your applications</span></div><div className={styles.grid}>{recommended.map(space=><CompanyTile key={space.key} space={space} open={()=>openCompany(space.company)}/>)}</div></section>}
   {!!explore.length&&<section className={styles.section} aria-label={query?'Matching companies':'More companies to explore'}>{!query&&<div className={styles.sectionHeading}><div><h3>More companies to explore</h3><p>Follow the conversations relevant to your search.</p></div></div>}<div className={styles.grid}>{explore.map(space=><CompanyTile key={space.key} space={space} open={()=>openCompany(space.company)}/>)}</div></section>}
   {!busy&&!error&&!spaces.length&&<div className={styles.empty}><h3>{query?'No companies found for that search.':'Your company spaces start here.'}</h3><p>{query?'Try a company name, role, or interview topic.':'Companies you’re interviewing with will appear here. Shared company threads from your Circles will show up as they become available.'}</p>{query&&<button className={secondary} onClick={reset}>Clear search</button>}</div>}
  </>}
  {busy&&!!page.items.length&&<Notice>Finding discussions…</Notice>}
  {page.nextCursor&&<button className={`${secondary} mt-6`} disabled={busy} onClick={()=>void load(true)}>{company?'More discussions':'Explore more companies'}</button>}
 </section>;
}
function CompanyTile({space,open}:{space:Space;open:()=>void}){
 const preview=space.posts.find(post=>post.content.type==='interview_report')||space.posts[0],topics=companyTopics(space.posts);
 return <article className={`${styles.tile} ${space.recommended?styles.recommended:''}`}>
  <div className={styles.identity}><CompanyLogo company={space.company}/><h4>{space.company}</h4>{space.recommended&&<span className={styles.stage}>{space.stage}</span>}</div>
  <p className={styles.role}>{space.role||'Explore shared recruiting experiences'}</p>
  <div className={styles.preview}>{preview?<><p className={styles.threadTitle}>{preview.content.title}</p><p className={styles.excerpt}>{preview.content.insight||preview.content.body}</p><p className={styles.source}>{[types[preview.content.type],preview.content.experienceDate||'Date unknown'].join(' · ')}</p></>:<><p className={styles.threadTitle}>What will your next round look like?</p><p className={styles.excerpt}>Explore your Circles for experiences that could help with your next round.</p></>}</div>
  {!!topics.length&&<ul className={styles.topics} aria-label="Discussion topics">{topics.slice(0,2).map(topic=><li key={topic}>{topic}</li>)}</ul>}
  <button type="button" aria-label={`Explore ${space.company} discussions`} className={styles.open} onClick={open}>Explore discussions<Arrow/></button>
 </article>;
}
function ThreadList({posts,openPost}:{posts:Post[];openPost:(post:Post)=>void}){
 return <ul className={styles.threads}>{posts.map(post=><li key={post.id}>
  <p className={styles.source}>{[post.circleName,post.author,post.content.experienceDate||'Experience date unknown'].filter(Boolean).join(' · ')}</p>
  <h4><button type="button" onClick={()=>openPost(post)}>{post.content.title}</button></h4>
  <p className={styles.source}>{[post.content.role,post.content.stage,types[post.content.type]].filter(Boolean).join(' · ')}</p>
  <p className={styles.threadBody}>{post.content.insight||post.content.body}</p>
  {post.content.uncertainty&&<p className={styles.source}>{post.content.uncertainty}</p>}
  <button type="button" className={styles.read} onClick={()=>openPost(post)}>Read and discuss<Arrow/></button>
 </li>)}</ul>;
}
