"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWorkspace } from "../lib/workspace";
import { applyNowCooldownRemaining, applyNowPackStamp, APPLY_NOW_COOLDOWN_MS, type ApplyNowDrop, type Drop } from "../lib/drop-pack";

const PackOpening = dynamic(() => import("./pack-opening"), { ssr: false });

export default function ApplyNowPack({ drops, onOpened }: { drops: ApplyNowDrop[]; onOpened: (drops: Drop[]) => void }) {
  const w = useWorkspace();
  const [pack, setPack] = useState<ApplyNowDrop[] | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (pack) return;
    const stamps = w.store.get("drops.packStamps") || {};
    const unopened = drops.filter(drop => !stamps[applyNowPackStamp(drop.packId)] && drop.recommendedAt && Date.now() - Date.parse(drop.recommendedAt) < APPLY_NOW_COOLDOWN_MS);
    if (!unopened.length) return;
    const activatedAt = Date.now();
    const remaining = applyNowCooldownRemaining(w.store.get("drops.applyNowLastActivatedAt"), activatedAt);
    if (remaining > 0) {
      const timer = window.setTimeout(() => setNow(Date.now()), remaining);
      return () => window.clearTimeout(timer);
    }
    w.store.update("drops", (previous: Record<string, any>) => ({ ...previous, applyNowLastActivatedAt: activatedAt,
      packStamps: { ...previous.packStamps, ...Object.fromEntries(unopened.map(drop => [applyNowPackStamp(drop.packId), true])) } }));
    w.store._flush();
    setPack(unopened);
  }, [drops, pack, w.store, w.demo, now]);
  if (!pack) return null;
  return <PackOpening title="Your Apply Now pack" packId="apply-now" drops={pack} day={pack[0].dateSeen} onClose={opened => {
    setPack(null);
    if (opened) onOpened(pack);
  }} />;
}
