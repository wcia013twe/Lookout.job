import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import { ActionBoardProvider } from "../lib/use-action-board";
import { WorkspaceReadsProvider } from "../lib/workspace-reads";
import { NetworkProvider } from "../lib/workspace-network";
import { WorkspaceProvider } from "../lib/workspace";
import { colorModeScript } from "../lib/color-mode";
import AppShell from "../components/app-shell";
export const metadata = {
  title: "Lookout",
  description: "Your next move is in the cards. The right opportunities, picked for you. Your agent handles the busywork.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/manifest.webmanifest`,
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-32.png`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-180.png`,
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><meta httpEquiv="Content-Security-Policy" content="frame-src 'self'" /><script dangerouslySetInnerHTML={{ __html: colorModeScript }} /></head>
      <body>
        <WorkspaceProvider>
          <WorkspaceReadsProvider>
            <NetworkProvider>
              <ActionBoardProvider>
                <AppShell>{children}</AppShell>
              </ActionBoardProvider>
            </NetworkProvider>
          </WorkspaceReadsProvider>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
