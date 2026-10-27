"use client";

import { useState } from "react";
import Link from "next/link";
import BrandMark from "./brand-mark";
import GoogleSignInButton from "./google-sign-in-button";
import { useWorkspace } from "../lib/workspace";

export default function AuthPage({ signup = false }: { signup?: boolean }) {
  const w = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function continueWithGoogle() {
    if (w.demo) { setError("This is a fictional preview. Exit demo mode to use your own account."); return; }
    setBusy(true);
    setError("");
    try { await w.signIn(); }
    catch { setError("Could not start sign-in. Please try again."); }
    finally { setBusy(false); }
  }
  const mode = w.demo ? "?demo=1" : "?demo=0";
  return <main className="min-h-dvh bg-board-bg px-6 text-board-text">
    <header className="mx-auto flex max-w-6xl items-center justify-between py-6">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xl font-bold"><BrandMark />Lookout</Link>
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-board-muted underline-offset-4 hover:underline">Back to home</Link>
    </header>
    <section className="mx-auto max-w-sm pb-16 pt-16 sm:pt-24" aria-labelledby="auth-title">
      <h1 id="auth-title" className="text-3xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-3 leading-relaxed text-board-muted">{signup ? "Keep your job search, applications, and next steps together." : "Log in to pick up your job search where you left off."}</p>
      <GoogleSignInButton className="mt-8 w-full" disabled={(!w.authReady && !w.demo) || busy} onClick={continueWithGoogle} label={busy ? "Connecting…" : !w.authReady && !w.demo ? "Checking sign-in…" : "Continue with Google"}/>
      <p className="mt-4 text-sm leading-relaxed text-board-muted">{signup ? "Use your Google account to sign up. Already joined? We’ll sign you in." : "Use the Google account you joined with. New here? You can create an account below."}</p>
      {(error || w.error) && <p role="alert" className="mt-4 text-sm leading-relaxed">{error || w.error}</p>}
      {w.demo && <p role="status" className="mt-4 text-sm text-board-muted">Fictional demo preview. No account will be created.</p>}
      <p className="mt-8 border-t border-board-line pt-6 text-sm text-board-muted">
        {signup ? "Already have an account? " : "New to Lookout? "}
        <Link className="inline-flex min-h-11 items-center font-medium text-board-accent underline underline-offset-4" href={`${signup ? "/login/" : "/signup/"}${mode}`}>{signup ? "Log in" : "Sign up"}</Link>
      </p>
      <Link href="/privacy/" className="mt-4 inline-flex min-h-11 items-center text-sm text-board-muted underline underline-offset-4">Privacy policy</Link>
    </section>
  </main>;
}
