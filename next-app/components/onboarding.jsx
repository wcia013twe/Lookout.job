"use client";
import { useState } from "react";
import Link from "next/link";
import AgentSelector from "./agent-selector";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, control, Field, Notice } from "./ui";
const steps = ["Your agent", "Your profile"];
const prompt =
  "Read my attached resume or Simplify profile PDF and fill my Job Signal Board profile directly. Save extracted facts as unverified, leave missing facts blank, and let me review them before they are used for applications.";
export default function Onboarding() {
  const w = useWorkspace(),
    profile = w.state.workflow.profile;
  const [step, setStep] = useState(0),
    [agent, setAgent] = useState(profile.setupAgent || "platform"),
    [agentName, setAgentName] = useState(profile.setupAgentName || ""),
    [provider, setProvider] = useState(profile.setupAgentProvider || (["Dot", "Grok Bot", "Muse"].includes(profile.setupAgentName) ? {Dot:"dot", "Grok Bot":"grok", Muse:"muse"}[profile.setupAgentName] : "custom")),
    [source, setSource] = useState(profile.profileSource || "muse"),
    [feedback, setFeedback] = useState(""),
    [done, setDone] = useState(false);
  function next(e) {
    e.preventDefault();
    setFeedback("");
    if (step === 0 && agent === "own" && !agentName.trim()) {
      setFeedback("Enter your agent’s name to continue.");
      return;
    }
    if (step < 1) {
      setStep(step + 1);
      return;
    }
    w.store.set("workflow.profile", {
      ...w.store.get("workflow.profile"),
      setupAgent: agent,
      setupAgentName: agent === "own" ? agentName.trim() : "",
      setupAgentProvider: agent === "own" ? provider : "platform",
      profileSource: source,
      verified: false,
    });
    setDone(true);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("Request copied. Paste it into Muse and attach your PDF.");
    } catch {
      setFeedback("Select the request below and copy it manually.");
    }
  }
  return (
    <div className="setup-experience flex min-h-dvh flex-col px-5 py-5 sm:px-10 sm:py-7">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold">Job signal board</Link>
        <Link href="/profile/" className={secondary}>Exit setup</Link>
      </header>
      <div className={`mx-auto flex w-full flex-1 flex-col justify-center py-7 sm:py-10 ${step === 0 && !done ? "max-w-5xl" : "max-w-xl"}`}>
      {done ? (
        <>
          <Heading title={source === "muse" ? "Talk to Muse. Make it yours." : "Your setup is saved."}>
            {source === "muse" ? "Tell Muse what you’re looking for and share your resume or Simplify profile PDF. Let it fill your profile, then review the details." : "Fill in your profile and review your facts before using them for applications."}
          </Heading>
          {source === "muse" && <>
            <blockquote className="mb-4 rounded-xl border border-board-line p-4 text-sm leading-relaxed">{prompt}</blockquote>
            <button className={`${secondary} mb-4`} type="button" onClick={copy}>Copy request for Muse</button>
            <Notice>{feedback}</Notice>
          </>}
          <Link className={primary} href="/profile/">
            Review your profile
          </Link>
        </>
      ) : (
        <>
          <ol
            aria-label="Setup progress"
            className="mx-auto mb-8 flex w-full max-w-lg justify-between gap-2 text-xs"
          >
            {steps.map((s, i) => (
              <li
                aria-current={i === step ? "step" : undefined}
                key={s}
                className="flex items-center gap-2"
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full ${i <= step ? "bg-board-accent text-board-ink" : "bg-board-tag text-board-muted"}`}
                >
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <form onSubmit={next} key={step}>
            {step === 0 && (
              <>
                <Heading title="Your search starts with a companion.">
                  Choose your own agent or use the platform’s suggestions.
                </Heading>
                <AgentSelector agent={agent} provider={provider} onSelect={(value, label) => {
                  setAgent(value === "platform" ? "platform" : "own");
                  setProvider(value);
                  setAgentName(value === "custom" ? "" : label);
                }} />
                {agent === "own" && provider === "custom" && (
                  <Field label="Agent name">
                    <input className={control} value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={100} placeholder="My career assistant" />
                  </Field>
                )}
                <Notice>
                  Your agent preference is saved here. Create its connection in
                  Profile.
                </Notice>
              </>
            )}
            {step === 1 && (
              <>
                <Heading title="Your profile. Less busywork.">
                  Start with your resume or a Simplify profile PDF, then review
                  the extracted details.
                </Heading>
                <fieldset>
                  <legend className="mb-3 text-sm font-bold">
                    How would you like to get started?
                  </legend>
                  {[
                    ["muse", "Use Muse with a PDF"],
                    ["manual", "I’ll fill it out myself"],
                  ].map(([value, label]) => (
                    <label
                      className={`mb-3 flex min-h-16 items-center gap-3 rounded-xl border bg-board-panel p-4 ${source === value ? "border-board-accent" : "border-board-line"}`}
                      key={value}
                    >
                      <input
                        type="radio"
                        name="source"
                        checked={source === value}
                        onChange={() => setSource(value)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {source === "muse" && (
                  <>
                    <p className="mt-4 text-sm leading-relaxed text-board-muted">
                      Send your PDF to Muse. Extracted facts stay unverified,
                      missing facts stay blank, and you review them before
                      application use.
                    </p>
                    <blockquote className="my-4 rounded-xl border border-board-line p-4 text-sm leading-relaxed">
                      {prompt}
                    </blockquote>
                    <button className={secondary} type="button" onClick={copy}>
                      Copy request for Muse
                    </button>
                    <Notice>
                      PDF extraction runs through Muse, outside this page.
                    </Notice>
                  </>
                )}
              </>
            )}
            <Notice>{feedback}</Notice>
            <div className="mx-auto mt-7 flex max-w-lg gap-3">
              {step > 0 && (
                <button
                  className={secondary}
                  type="button"
                  onClick={() => {
                    setStep(step - 1);
                    setFeedback("");
                  }}
                >
                  Back
                </button>
              )}
              <button className={`${primary} flex-1`} type="submit">
                {step === 1 ? (source === "muse" ? "Finish & talk to Muse" : "Finish setup") : "Continue"}
              </button>
            </div>
          </form>
        </>
      )}
      </div>
    </div>
  );
}
