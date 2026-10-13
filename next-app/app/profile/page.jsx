import ProfilePreview from '../../components/profile-preview';
import Link from 'next/link';
export default function ProfilePage() {
  return <><h1 className="text-3xl font-bold">My Profile</h1><p className="mt-3 text-board-muted">Migration preview. Try the shared field structure here; changes are not saved or synced. Use the existing board for your application facts.</p><div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"><Link className="inline-flex min-h-12 items-center justify-center rounded-lg bg-board-accent px-5 py-3 font-bold text-board-bg hover:opacity-90" href="/onboarding/">Start setup</Link><p className="text-sm text-board-muted">Choose your agent, set up your profile, and introduce yourself.</p></div><ProfilePreview /></>;
}
