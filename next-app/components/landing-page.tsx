"use client";
import Link from "next/link";
import { useState } from "react";
import BrandMark from "./brand-mark";
import OnboardingRoleReveal from "./onboarding-role-reveal";
import LandingMascot from "./landing-mascot";
import LandingWorkflow from "./landing-workflow";
import LandingTimeShift from "./landing-time-shift";
import { CompanyLogo, type Role } from "./role-card";
import ProfileIcon from "./profile-icon";
import { primary, secondary } from "./ui";
import styles from "./landing-page.module.css";

const examples: Role[] = [
  { company: "Google", title: "Software Engineer", whyItFits: "Strong alignment with your backend and AI engineering experience.", category: "Backend · AI/ML" },
  { company: "Meta", title: "Software Engineer", whyItFits: "A chance to build on your interest in distributed systems at scale.", category: "Infrastructure · Systems" },
  { company: "Stripe", title: "Backend Engineer", whyItFits: "Your API projects are a useful starting point for payments infrastructure.", category: "Backend · APIs" },
].map((role, index) => ({ ...role, id: `landing-example-${index}`, employmentType: "New Grad", location: "Illustrative role", priority: "Strong Consider", discoveredDate: "", sourceFreshness: "Fictional example", applicationUrl: "" }));
const assessments = [
  {percent:92, values:[96,88,76,94], reasons:["Your example profile’s Python, backend APIs and AI projects align with this sample role’s technical focus.", "The sample compensation range meets Alex’s stated target; a real offer would need verification.", "Mentorship matters to Alex. Team support and working hours are questions to check, not assumed facts.", "Alex prefers the Bay Area and is open to hybrid work, matching this illustrative opportunity."]},
  {percent:87, values:[92,90,68,88], reasons:["Alex’s distributed-systems coursework and backend project align with this sample infrastructure role.", "This example fits the preferred compensation range; actual level and equity would need verification.", "The sample highlights a gap: the team’s pace and mentorship are still unknown.", "Alex is open to this example’s hybrid setup; the specific office and team would need confirmation."]},
  {percent:89, values:[94,86,81,90], reasons:["Alex’s API and database projects map to the sample role’s backend focus.", "The example range aligns with Alex’s target, pending verification of real compensation details.", "This sample weights collaboration and mentorship highly; the actual team would need research.", "The example fits Alex’s Bay Area preference; confirm location rules on a real posting."]},
];
examples.forEach((role, i) => {
  const sample = assessments[i];
  role.matchPreview = {percent:sample.percent,assessedAt:"2026-10-01T12:00:00Z",evidence:"Fictional profile and role comparison only.",
    skillsExperience:{score:sample.values[0],reasoning:sample.reasons[0]},
    compensation:{score:sample.values[1],reasoning:sample.reasons[1]},
    wellbeingCulture:{score:sample.values[2],reasoning:sample.reasons[2]},
    locationWorkSetting:{score:sample.values[3],reasoning:sample.reasons[3]}};
});
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LandingPage() {
  const [index, setIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const [paused, setPaused] = useState(false);
  const [review, setReview] = useState(false);
  const [feedback, setFeedback] = useState("");
  const role = examples[index];
  function pass() {
    setIndex(value => (value + 1) % examples.length);
    setReview(false);
    setFeedback("Next example. Preview choices aren’t saved.");
  }
  return <main className={styles.page}>
    <a href="#landing-content" className={styles.skip}>Skip to content</a>
    <header className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="Lookout home"><BrandMark />Lookout</Link>
      <nav aria-label="Account"><Link href="/discover/?demo=0" className={styles.login}>Log in</Link><Link href="/onboarding/" className={primary}>Get started free</Link></nav>
    </header>
    <div id="landing-content" className={styles.content}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">Your next move<br/>is in the cards.</h1>
          <p>The right opportunities, picked for you.<br className={styles.desktopBreak}/> Your agent handles the busywork.</p>
          <Link href="/onboarding/" className={`${primary} ${styles.cta}`}>Find your next move <ProfileIcon name="arrow" aria-hidden="true"/></Link>
          <span className={styles.freeNote}>Free to connect your own agent.</span>
          <div className={styles.mascot}><LandingMascot paused={paused}/><button className={styles.motionControl} onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? "Resume motion" : "Pause motion"}</button></div>
        </div>
        <div className={styles.cardStage}>
          <div className={styles.profileContext}><span className={styles.profileAvatar}>A</span><div><strong>Picked for Alex <span>· Example profile</span></strong><p>New grad · Backend &amp; AI · Bay Area</p></div></div>
          <div className={`lookout-onboarding ${styles.tutorial}`}>
            <OnboardingRoleReveal key={replay} role={role} demo presentation="landing" expanded={review} onPrepare={() => setReview(true)} onLater={pass}>
              <p className={styles.fitReason}>{role.whyItFits}</p>
              <div className={styles.cardActions}><button className={secondary} onClick={pass}>Pass</button><button className={primary} aria-expanded={review} aria-controls="landing-role-review" onClick={() => setReview(value => !value)}>{review ? "Close details" : "Review role"}<ProfileIcon name="arrow" aria-hidden="true"/></button></div>
              {review && <div id="landing-role-review" className={styles.review}>
                <strong>Explore your match</strong><p>Open any match factor above to see the example reasoning, including what still needs checking.</p>
                <Link href="/onboarding/">Connect your agent to review real roles <ProfileIcon name="arrow" aria-hidden="true"/></Link>
                <small>Reviewing a role never submits an application.</small>
              </div>}
            </OnboardingRoleReveal>
          </div>
          <div className={styles.cardCaption}><p className={styles.caption}>Illustrative role, not a live listing</p><button onClick={() => setReplay(value => value + 1)}>Replay reveal</button></div>
          <p className={styles.feedback} role="status">{feedback}</p>
        </div>
      </section>

      <LandingTimeShift />
      <LandingWorkflow />

      <section className={styles.section} aria-labelledby="checkin-title">
        <div className={styles.sectionCopy}><h2 id="checkin-title">Google and Meta<br/>just dropped.</h2><p>Stay in the loop without living on job boards.</p><span className={styles.smallNote}>Check-ins from your connected agent, on your schedule.</span></div>
        <div className={`${styles.preview} ${styles.checkin}`}>
          <header className={styles.previewHead}><div className={styles.identity}><img src={`${base}/agents/muse.png`} alt="" width={42} height={42}/><div><strong>Muse</strong><span>Your recruiting check-in</span></div></div><span className={styles.example}>Example</span></header>
          <p className={styles.message}>New opportunities worth reviewing:</p>
          <div className={styles.opportunities}>{["Google", "Meta"].map(company => <div className={styles.opportunity} key={company}><CompanyLogo company={company}/><div><strong>{company}</strong><span>Software Engineering · Example role</span></div><ProfileIcon name="arrow" aria-hidden="true"/></div>)}</div>
          <div className={styles.previewFoot}><span className={styles.statusDot}/><span>Picked for your next move.</span></div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.reverse}`} aria-labelledby="prep-title">
        <div className={styles.sectionCopy}><h2 id="prep-title">Show up ready.</h2><p>Less digging for answers.<br/>More time to prepare.</p></div>
        <div className={`${styles.preview} ${styles.prep}`}>
          <header className={styles.previewHead}><div className={styles.identity}><ProfileIcon name="file" width={25} height={25} aria-hidden="true"/><strong>Interview prep</strong></div><span className={styles.example}>Example</span></header>
          <h3>Upcoming technical interview</h3>
          <ul>{["Interview format researched", "Preparation priorities identified", "Practice plan ready for review"].map(text => <li key={text}><ProfileIcon name="check" aria-hidden="true"/><span>{text}</span></li>)}</ul>
          <div className={styles.prepNote}><ProfileIcon name="clock" aria-hidden="true"/><span>A clearer plan for what comes next.</span></div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="circle-title">
        <div className={styles.sectionCopy}><h2 id="circle-title">Get the inside<br/>perspective.</h2><p>Join Circles. See what other<br className={styles.desktopBreak}/> candidates are discussing.</p></div>
        <div className={`${styles.preview} ${styles.circle}`}>
          <header className={styles.previewHead}><div className={styles.identity}><CompanyLogo company="Google"/><strong>Google Circle</strong></div><span className={styles.example}>Illustrative</span></header>
          <div className={styles.discussion}><div className={styles.author}><span className={styles.avatar}>J</span><span>Jordan <span>· Candidate</span></span></div><h3>Anyone heard back<br/>after the OA?</h3><div className={styles.tags}><span>New Grad SWE</span><span>Recruiting timeline</span></div></div>
          <div className={styles.previewFoot}><ProfileIcon name="conversation" aria-hidden="true"/><span>Candidate discussion preview</span></div>
        </div>
      </section>
      <div className={styles.close}><p>Your agent. Your next move.</p><Link href="/onboarding/" className={`${primary} ${styles.cta}`}>Get started free <ProfileIcon name="arrow" aria-hidden="true"/></Link><span>Connect your existing agent for free.</span></div>
    </div>
    <footer className={styles.footer}><Link href="/" className={styles.brand}><BrandMark/>Lookout</Link><p>Less applying. More becoming.</p><Link href="/privacy/">Privacy</Link></footer>
  </main>;
}
