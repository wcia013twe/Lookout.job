import Link from "next/link";
import { Heading } from "../../components/ui";

export const metadata = {
  title: "Privacy & sharing · Lookout",
  description: "What Lookout stores, when information is shared, and the controls available to you.",
};

const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();
const link = "underline underline-offset-4 hover:text-board-text";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[70ch] pb-4">
      <Heading title="Privacy & sharing">
        Your job search stays private by default. You choose which agents can access your workspace and what you share with your Circles.
      </Heading>
      <p className="mb-8 text-xs text-board-muted">Last updated October 22, 2026</p>
      <div className="space-y-8 text-sm leading-7 text-board-muted [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-board-text">
        <section aria-labelledby="collected">
          <h2 id="collected">What we store and why</h2>
          <p>Lookout stores the profile, resumes, saved answers, preferences, contacts and application records you provide to organize your job search. Guest data stays in your browser; signing in enables cloud storage. Browser storage also remembers your session and preferences. Hosting and security providers may process technical information such as IP addresses and operational logs.</p>
        </section>
        <section aria-labelledby="sharing">
          <h2 id="sharing">When information is shared</h2>
          <p>Employers receive application information when you submit or authorize submission under your application settings. Opening a job link is not applying; the employer’s site has its own privacy practices. Lookout does not sell personal information, use it for targeted advertising, or offer unsolicited recruiter access to your profile.</p>
        </section>
        <section aria-labelledby="agents">
          <h2 id="agents" className="scroll-mt-6">Agents and service providers</h2>
          <p>Connected agents can access information within the permissions you grant, including private files when permitted. Their AI providers have their own processing, retention and training policies. Lookout does not train AI models on your private workspace content. <Link href="/profile/" className={link}>Manage agent access in My Profile → My agent</Link>; revoking access stops future requests but does not erase information already received.</p>
          <p className="mt-3">GitHub Pages hosts the website; Supabase provides account sign-in, private data and file storage; Google handles optional Google sign-in. These providers process information needed to deliver those services. Information may also be disclosed when legally required or necessary to address security threats or abuse.</p>
        </section>
        <section aria-labelledby="circles">
          <h2 id="circles">Circles and public progress</h2>
          <p>Joining a Circle does not expose your tracker. Shared posts are visible to its members and their permitted agents. Review the destination and attached details before sharing. Members may copy content, and an alias does not guarantee anonymity. Leaving a Circle does not remove earlier posts; you can withdraw your contributions while you have access. Public leaderboard participation is optional and shares your alias and aggregate metrics. <Link href="/progress/#sharing-privacy" className={link}>Manage public progress</Link>.</p>
        </section>
        <section aria-labelledby="retention">
          <h2 id="retention">Retention and your choices</h2>
          <p>Saved workspace data remains available while you use Lookout. Application history and file versions may be retained after an edit; removing visible content may not immediately erase retained versions, logs or backups. Self-service account export and deletion are not available yet, and a fixed deletion or backup-expiry timeline has not been established.</p>
          <p className="mt-3">You can edit your saved information, revoke agent access and change sharing settings using the existing controls. Clearing browser storage removes local copies, not cloud records or information already received by employers, agents or Circle members.</p>
        </section>
        <section aria-labelledby="contact">
          <h2 id="contact">Questions and requests</h2>
          <p>{privacyEmail ? <>For access, correction or deletion requests, email <a className={`${link} break-words`} href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.</> : <>For access, correction or deletion requests, contact the person who provided your Lookout access through your existing contact channel.</>} Do not include resumes or sensitive application information in public issues. We will update this page when our practices change.</p>
        </section>
      </div>
    </article>
  );
}
