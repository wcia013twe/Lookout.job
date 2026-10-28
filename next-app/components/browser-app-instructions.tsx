"use client";

import { useEffect, useState } from "react";

type Guide = { browser: string; steps: string[]; help: string };
const chrome: Guide = {
  browser: "Chrome",
  steps: ["⋮", "Choose Cast, save and share", "Choose Install page as app"],
  help: "https://support.google.com/chrome/answer/9658361",
};

export default function BrowserAppInstructions() {
  const [guide, setGuide] = useState<Guide>(chrome);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      setGuide({ browser: "Safari on iPhone or iPad", steps: ["Open Lookout in Safari", "Share", "Choose Add to Home Screen", "Keep Open as Web App on, then tap Add"], help: "https://support.apple.com/guide/iphone/iphea86e5236/ios" });
    } else if (/Android/.test(ua)) {
      setGuide({ browser: "Chrome on Android", steps: ["Open Lookout in Chrome", "⋮", "Choose Add to home screen", "Tap Install"], help: "https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid" });
    } else if (/Edg\//.test(ua)) {
      setGuide({ browser: "Microsoft Edge", steps: ["…", "Choose More tools, then Apps", "Choose Install this site as an app"], help: "https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge" });
    } else if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) {
      setGuide({ browser: "Safari on Mac", steps: ["Open the File menu", "Choose Add to Dock", "Click Add"], help: "https://support.apple.com/104996" });
    } else if (!/Chrome|Chromium/.test(ua)) {
      setGuide({ ...chrome, browser: "Use Chrome to save Lookout as an app", steps: ["Open Lookout in Chrome", "⋮", "Choose Cast, save and share", "Choose Install page as app"] });
    }
  }, []);
  if (installed) return null;
  return <aside className="browser-app-instructions" aria-label="Save Lookout as an app">
    <div className="app-save-heading">
      <span className="app-save-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M12 7v8m-3-3 3 3 3-3M9 18h6"/></svg></span>
      <div><h2>Save Lookout as an app.</h2><p>Your next move, one tap away.</p></div>
    </div>
    <p className="app-save-browser">On {guide.browser.startsWith('Use ') ? 'another browser? Open Lookout in Chrome.' : guide.browser}</p>
    <ol className="app-save-steps">{guide.steps.map((step, index)=><li key={step}><span className="app-save-number" aria-hidden="true">{index+1}</span><span>{step==='Share'?<><svg className="app-save-menu" aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/></svg>Tap Share</>:['⋮','…'].includes(step)?<><svg className="app-save-menu" aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>Open the browser menu</>:step}</span></li>)}</ol>
    <p className="app-save-footer">Optional · You can keep using Lookout in your browser.</p>
    <a href={guide.help} target="_blank" rel="noreferrer">See {guide.browser.startsWith('Use ')?'Chrome':guide.browser} instructions <span aria-hidden="true">↗</span></a>
  </aside>;
}
