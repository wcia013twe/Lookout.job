"use client";

import { useEffect, useState } from "react";

type Guide = { browser: string; steps: string; help: string };
const chrome: Guide = {
  browser: "Chrome",
  steps: "Open ⋮ → Cast, save and share → Install page as app.",
  help: "https://support.google.com/chrome/answer/9658361",
};

export default function BrowserAppInstructions() {
  const [guide, setGuide] = useState<Guide>(chrome);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      setGuide({ browser: "Safari on iPhone or iPad", steps: "Open Lookout in Safari. Tap Share → Add to Home Screen, keep Open as Web App on, then tap Add.", help: "https://support.apple.com/guide/iphone/iphea86e5236/ios" });
    } else if (/Android/.test(ua)) {
      setGuide({ browser: "Chrome on Android", steps: "Open Lookout in Chrome. Tap ⋮ → Add to home screen → Install.", help: "https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid" });
    } else if (/Edg\//.test(ua)) {
      setGuide({ browser: "Microsoft Edge", steps: "Open … → More tools → Apps → Install this site as an app.", help: "https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge" });
    } else if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) {
      setGuide({ browser: "Safari on Mac", steps: "Choose File → Add to Dock, then click Add.", help: "https://support.apple.com/104996" });
    } else if (!/Chrome|Chromium/.test(ua)) {
      setGuide({ ...chrome, browser: "Use Chrome to save Lookout as an app", steps: "Open Lookout in Chrome, then choose ⋮ → Cast, save and share → Install page as app." });
    }
  }, []);
  if (installed) return null;
  return <aside className="browser-app-instructions" aria-label="Save Lookout as an app">
    <h2>Keep Lookout close.</h2>
    <p>Save it as an app for next time.</p>
    <p><strong>{guide.browser}</strong><br/>{guide.steps}</p>
    <a href={guide.help} target="_blank" rel="noreferrer">Browser instructions</a>
  </aside>;
}
