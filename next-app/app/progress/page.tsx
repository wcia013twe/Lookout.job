import Link from "next/link";
import Leaderboard from "../../components/leaderboard";
import { Heading } from "../../components/ui";
export const metadata = { title: "Progress · Lookout" };
export default function Page() {
  return <div id="sharing-privacy"><Heading title="Progress">Your account progress and leaderboard sharing settings.</Heading><Leaderboard /><Link href="/privacy/" className="mt-6 inline-flex min-h-11 items-center text-sm text-board-muted underline underline-offset-4">Read the privacy policy</Link></div>;
}
