"use client";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { secondary } from "./ui";

export function PackSetupSuggestion() {
  const w = useWorkspace();
  return <aside aria-label="Set up discoveries" className="my-5 flex flex-wrap items-center justify-between gap-4 border-y border-board-line py-4">
    <div className="max-w-prose">
      <p className="font-semibold">Get discoveries from your agent.</p>
    </div>
    <Link className={secondary} href={w.demo?"/profile/?section=agent&demo=1#pack-setup":"/profile/?section=agent#pack-setup"}>Set up packs &amp; connection</Link>
  </aside>;
}
