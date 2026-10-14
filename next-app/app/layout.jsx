import "./globals.css";
import { WorkspaceProvider } from "../lib/workspace";
import AppShell from "../components/app-shell";
export const metadata = {
  title: "Job Signal Board",
  description: "Your job-search workspace: discover, apply, and track.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/manifest.webmanifest`,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg` },
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
