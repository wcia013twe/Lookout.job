import Leaderboard from "../../components/leaderboard";
import { Heading } from "../../components/ui";
export const metadata = { title: "Progress · Job Signal Board" };
export default function Page() {
  return <><Heading title="Progress">Your account progress and leaderboard sharing settings.</Heading><Leaderboard /></>;
}
