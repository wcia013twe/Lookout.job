"use client";
import {useWorkspace} from "../lib/workspace";
import {useApplicationProfile} from "./application-profile-context";
import ProfileIcon,{type ProfileIconName} from "./profile-icon";
import {profileStyles as styles} from "./profile-surface";
import {profileOverviewStats,profileDisplayName} from "../../lib/profile-overview.mjs";

type Section="about"|"kit"|"preferences";
export default function ProfileOverview({onSelect}:{onSelect:(section:Section)=>void}){
 const w=useWorkspace(),a=useApplicationProfile(),profile=w.state.workflow.profile;
 const displayName=profileDisplayName(profile,a.field("Application identity","Preferred first name").value,a.field("Application identity","Preferred last name").value);
 const stats=profileOverviewStats(w.state);
 const email=profile.email;
 const resume=w.state.workflow.resumes.find((item:{id:string})=>item.id===a.field("Application materials","Default resume ID").value);
 const rows:{section:Section;icon:ProfileIconName;title:string;attention:string}[]=[
  {section:"about",icon:"user",title:"About me",attention:[!profile.verified&&"Review background",!email&&"Add email address"].filter(Boolean).join(" · ")},
  {section:"kit",icon:"file",title:"Personalization",attention:resume?"":"Choose a resume"},
  {section:"preferences",icon:"sliders",title:"Job preferences",attention:!a.profile.active?"Search paused":!a.field("Role preferences","Roles").value?"Set target roles":""},
 ];
 return <div className={styles.overview}>
  <section className={styles.overviewIdentity} aria-label="Account overview">
   <div className={styles.overviewAvatar} aria-hidden="true">{displayName?displayName.split(" ").map((part:string)=>part[0]).slice(0,2).join(""):<ProfileIcon name="user" width={24} height={24}/>}</div>
   <div className={styles.overviewIdentityText}><h2>{displayName||"Your profile"}</h2>{(profile.headline||profile.location)&&<p>{[profile.headline,profile.location].filter(Boolean).join(" · ")}</p>}</div>
   <button type="button" className={styles.overviewEdit} aria-label="Edit background" title="Edit background" onClick={()=>onSelect("about")}><ProfileIcon name="pen" width={18} height={18}/></button>
  </section>
  <dl className={styles.overviewMetrics} aria-label="Account-wide job search statistics">
   {[{label:"Applications",value:stats.applied},{label:"Interviews",value:stats.interviewing},{label:"Offers",value:stats.offers}].map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
  </dl>
  <nav className={styles.overviewNav} aria-label="Profile shortcuts">
   {rows.map(row=><button type="button" key={row.section} onClick={()=>onSelect(row.section)}><ProfileIcon name={row.icon} width={20} height={20}/><span className={styles.overviewNavText}><span>{row.title}</span>{row.attention&&<span className={styles.overviewAttention}>{row.attention}</span>}</span><ProfileIcon name="arrow" width={18} height={18}/></button>)}
  </nav>
 </div>;
}
