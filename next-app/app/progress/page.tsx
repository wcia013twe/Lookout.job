import Leaderboard from "../../components/leaderboard";
import { Heading } from "../../components/ui";
export const metadata = { title: "Progress · Lookout" };
export default function Page() {
  return <div id="sharing-privacy"><Heading title="Progress">Your account progress and leaderboard sharing settings.</Heading><Leaderboard /></div>;
}
