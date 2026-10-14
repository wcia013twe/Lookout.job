import DemoSafeProfile from "../../components/demo-safe-profile";
import Profile from "../../components/profile-editor";
import Resumes from "../../components/resumes";
import SavedAnswers from "../../components/saved-answers";
import Preferences from "../../components/preferences";
import TierLists from "../../components/tierlists";
import AgentConnections from "../../components/agent-connections";
import Leaderboard from "../../components/leaderboard";
import { Heading } from "../../components/ui";
export const metadata = { title: "Profile · Job Signal Board" };
export default function Page() {
  return (
    <DemoSafeProfile>
      <Heading title="My Profile">
        Save your facts, resumes, and search preferences. Review imported
        details before they are used for applications.
      </Heading>
      <Profile />
      <Resumes />
      <Preferences />
      <TierLists />
      <SavedAnswers />
      <AgentConnections />
      <Leaderboard />
    </DemoSafeProfile>
  );
}
