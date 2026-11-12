"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWorkspace } from "../lib/workspace";
import { applyNowPackStamp, type ApplyNowDrop, type Drop } from "../lib/drop-pack";

const PackOpening = dynamic(() => import("./pack-opening"), { ssr: false });

export default function ApplyNowPack({ drops, onOpened }: { drops: ApplyNowDrop[]; onOpened: (drops: Drop[]) => void }) {
  const w = useWorkspace();
  const [pack, setPack] = useState<ApplyNowDrop[] | null>(null);
  useEffect(() => {
    if (pack) return;
    const stamps = w.store.get("drops.packStamps") || {};
    const unopened = drops.filter(drop => !stamps[applyNowPackStamp(drop.packId)]);
    if (!unopened.length) return;
    w.store.set("drops.packStamps", { ...stamps, ...Object.fromEntries(unopened.map(drop => [applyNowPackStamp(drop.packId), true])) });
    w.store._flush();
    setPack(unopened);
  }, [drops, pack, w.store]);
  if (!pack) return null;
  return <PackOpening title="Your Apply Now pack" packId="apply-now" drops={pack} day={pack[0].dateSeen} onClose={opened => {
    setPack(null);
    if (opened) onOpened(pack);
  }} />;
}
