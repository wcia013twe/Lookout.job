"use client";

import Link from "next/link";
import { asset, useWorkspace } from "../lib/workspace";
import { PACK_TEXTURES, resolvePackTexture } from "../styles/templates/pack-styles";
import ColorModeControl from "./color-mode";
import ThemeMarketplace from "../app/themes/theme-marketplace";

const original = "radial-gradient(ellipse at 16% 22%,#7edff84f,transparent 42%),radial-gradient(ellipse at 82% 74%,#ffd98f4a,transparent 44%),radial-gradient(ellipse at 64% 18%,#d9b7ff45,transparent 38%),linear-gradient(145deg,#111827,#080a12 64%,#171024)";
const background = (image: string | null) => image ? `linear-gradient(#07101e22,#07101e5c),url("${asset(image)}")` : original;

export default function AppearanceSettings() {
  const w = useWorkspace();
  const texture = resolvePackTexture(w.state.workflow.theme?.pack);
  return <div className="space-y-8">
    <div><h2 className="text-2xl font-bold tracking-tight">Appearance</h2><p className="mt-2 text-sm text-board-muted">Make Lookout feel like yours.</p></div>
    <div className="space-y-3"><h3 className="text-base font-semibold">Color theme</h3><ColorModeControl /></div>
    <section className="border-t border-board-line pt-6" aria-labelledby="workspace-setup-title">
      <h3 id="workspace-setup-title" className="text-base font-semibold">Setup &amp; guidance</h3>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <Link href={w.demo ? "/onboarding/?demo=1" : "/onboarding/"} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-board-accent">Open onboarding</Link>
        <Link href={w.demo ? "/?demo=1&tour=replay" : "/?tour=replay"} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-board-accent">Dashboard tour</Link>
      </div>
    </section>
    <section className="border-t border-board-line pt-6" aria-labelledby="pack-texture-title">
      <h3 id="pack-texture-title" className="text-base font-semibold">Pack texture</h3>
      <p className="mt-2 text-sm text-board-muted">Choose the wrapper for your daily drop packs.{w.demo ? " Demo changes stay in memory." : ""}</p>
      <div className="mt-6 grid items-start gap-8 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="mx-auto w-40 sm:w-full">
          <div role="img" aria-label={`${texture.label} pack preview`} className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl bg-cover bg-center px-4 text-center text-white" style={{ backgroundImage: background(texture.image) }}>
            <strong className="text-xl leading-tight [text-shadow:0_2px_8px_#000]">Your next<br />big move.</strong>
            <span className="mt-6 text-xs font-medium [text-shadow:0_1px_4px_#000]">Daily drop pack</span>
          </div>
          <p className="mt-3 text-center text-xs text-board-muted" role="status">{texture.label} preview</p>
        </div>
        <fieldset className="min-w-0">
          <legend className="sr-only">Pack texture</legend>
          <div className="grid grid-cols-3 gap-4">
            {PACK_TEXTURES.map(option => <label key={option.id} className="flex cursor-pointer flex-col items-center gap-2 text-sm">
              <input className="peer sr-only" type="radio" name="pack-texture" value={option.id} checked={texture.id === option.id} onChange={() => w.store.set("workflow.theme", { ...w.store.get("workflow.theme"), pack: option.id })} />
              <span aria-hidden="true" className="block size-14 rounded-xl border-2 border-board-line bg-cover bg-center peer-checked:border-board-accent peer-checked:ring-2 peer-checked:ring-board-accent peer-checked:ring-offset-2 peer-checked:ring-offset-board-panel peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-board-accent" style={{ backgroundImage: background(option.image) }} />
              <span className="text-board-text">{option.label}</span>
            </label>)}
          </div>
        </fieldset>
      </div>
    </section>
    <ThemeMarketplace embedded/>

    {(w.accountUser || w.demo) && <section className="border-t border-board-line pt-6" aria-label="Workspace reset">
      <Link href={w.demo ? "/workspace-reset/?demo=1" : "/workspace-reset/"} className="inline-flex min-h-11 items-center text-sm text-board-muted underline underline-offset-4 hover:text-board-text">Reset workspace</Link>
    </section>}
  </div>;
}
