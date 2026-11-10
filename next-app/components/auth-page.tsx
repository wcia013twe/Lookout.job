"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import BrandMark from "./brand-mark";
import GoogleSignInButton from "./google-sign-in-button";
import { useWorkspace } from "../lib/workspace";
import { asset } from "../lib/workspace-context";
import { passwordSignIn, requestPasswordSetup, savePassword } from "../lib/password-auth.mjs";
import { control, primary } from "./ui";

export default function AuthPage({ signup = false, resetPassword = false }: { signup?: boolean; resetPassword?: boolean }) {
  const w = useWorkspace();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recover, setRecover] = useState(false);
  const [saved, setSaved] = useState(false);
  const disabled = (!w.authReady && !w.demo) || Boolean(busy);
  const mode = w.demo ? "?demo=1" : "?demo=0";
  async function run(action: string, operation: () => Promise<void>) {
    setBusy(action); setError(""); setMessage("");
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { setBusy(""); setPassword(""); setConfirmation(""); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(resetPassword ? "update" : recover ? "recovery" : "password", async () => {
      if (w.demo) { setMessage("Fictional demo: no sign-in, email, or password change was sent."); return; }
      if (resetPassword) {
        if (!w.user) throw Error("Open the password link from your email, or request a new link from Log in.");
        await savePassword(w.client,password,confirmation); setSaved(true);
      } else if (recover) {
        await requestPasswordSetup(w.client,email,new URL(asset("reset-password/"),location.origin).href);
        setMessage("If this email has an account, a password link is on its way. Open it in this browser to choose your password.");
      } else await passwordSignIn(w.client,email,password);
    });
  }
  const title = resetPassword ? "Choose your password" : recover ? "Set or reset your password" : signup ? "Create your account" : "Welcome back";
  return <main className="min-h-dvh bg-board-bg px-6 text-board-text">
    <header className="mx-auto flex max-w-6xl items-center justify-between py-6">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xl font-bold"><BrandMark />Lookout</Link>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-board-muted underline-offset-4 hover:underline">Back to home</Link>
    </header>
    <section className="mx-auto max-w-sm pb-16 pt-12 sm:pt-20" aria-labelledby="auth-title">
      <h1 id="auth-title" className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 leading-relaxed text-board-muted">{resetPassword ? "Use this password to sign in to your existing Lookout account." : recover ? "Choose a password for your existing account, including an account created with Google." : signup ? "Keep your job search, applications, and next steps together." : "Log in to pick up your job search where you left off."}</p>
      {resetPassword && !w.user && !w.demo ? <p role="status" className="mt-6 text-sm leading-relaxed text-board-muted">Open the password setup link from your email. If it has expired, request a new link from <Link className="text-board-accent underline" href={`/login/${mode}`}>Log in</Link>.</p> : !signup && !saved && <form className="mt-7 space-y-4" onSubmit={submit} aria-busy={Boolean(busy)}>
        {resetPassword ? <>
          {w.user?.email && <p className="break-words text-sm text-board-muted">{w.user.email}</p>}
          <label className="block text-sm">New password<input className={`${control} mt-2`} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} disabled={disabled}/></label>
          <p className="text-sm text-board-muted">Use at least 8 characters.</p>
          <label className="block text-sm">Confirm password<input className={`${control} mt-2`} type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={disabled}/></label>
        </> : <>
          <label className="block text-sm">Email<input className={`${control} mt-2`} type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={disabled}/></label>
          {!recover && <label className="block text-sm">Password<input className={`${control} mt-2`} type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} disabled={disabled}/></label>}
        </>}
        <button className={`${primary} w-full`} type="submit" disabled={disabled}>{busy === "update" ? "Saving…" : busy === "recovery" ? "Sending…" : busy === "password" ? "Signing in…" : resetPassword ? "Save password" : recover ? "Send password link" : "Sign in"}</button>
        {!resetPassword && <button className="min-h-11 text-sm text-board-accent underline underline-offset-4 disabled:opacity-50" type="button" disabled={Boolean(busy)} onClick={()=>{setRecover(!recover);setError("");setMessage("");setPassword("");}}>{recover ? "Back to sign in" : "Set or reset password"}</button>}
      </form>}
      {saved && <div className="mt-6"><p role="status">Password saved. You can now sign in with your email and password.</p><Link className={`${primary} mt-5`} href={`/${mode}`}>Continue to your workspace</Link></div>}
      {!resetPassword && !recover && <>
        {!signup && <p className="my-5 text-center text-sm text-board-muted">or</p>}
        <GoogleSignInButton className={`${signup ? "mt-8 " : ""}w-full`} disabled={disabled} onClick={()=>void run("google",async()=>{if(w.demo){setMessage("Fictional demo: no sign-in was sent.");return;}await w.signIn();})} label={busy === "google" ? "Connecting…" : !w.authReady && !w.demo ? "Checking sign-in…" : "Continue with Google"}/>
        <p className="mt-4 text-sm leading-relaxed text-board-muted">{signup ? "Continuing with Google creates your account, or signs you in if you already joined." : "Use the same email as your existing account to open your saved workspace."}</p>
      </>}
      {(error || w.error) && <p role="alert" className="mt-4 text-sm leading-relaxed">{error || w.error}</p>}
      {message && <p role="status" className="mt-4 text-sm leading-relaxed text-board-muted">{message}</p>}
      {w.demo && <p className="mt-4 text-sm text-board-muted">Fictional preview. Your real account stays untouched.</p>}
      {!resetPassword && <p className="mt-8 border-t border-board-line pt-6 text-sm text-board-muted">
        {signup ? "Already have an account? " : "New to Lookout? "}
        <Link className="inline-flex min-h-11 items-center font-medium text-board-accent underline underline-offset-4" href={`${signup ? "/login/" : "/signup/"}${mode}`}>{signup ? "Log in" : "Sign up"}</Link>
      </p>}
      <Link href="/privacy/" className="mt-4 inline-flex min-h-11 items-center text-sm text-board-muted underline underline-offset-4">Privacy policy</Link>
    </section>
  </main>;
}
