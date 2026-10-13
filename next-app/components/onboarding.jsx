'use client';
import { useState } from 'react';
import Link from 'next/link';
import '../styles/onboarding.css';
const steps = ['Your agent', 'Your profile', 'About you'];
export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [agent, setAgent] = useState('platform');
  const [agentName, setAgentName] = useState('');
  const [source, setSource] = useState('muse');
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const musePrompt = 'Read my attached resume or Simplify profile PDF and fill my Job Signal Board profile directly. Save extracted facts as unverified, leave missing facts blank, and let me review them before they are used for applications.';
  async function copyMusePrompt() {
    try { await navigator.clipboard.writeText(musePrompt); setCopied(true); setError(''); }
    catch { setError('Copy the request shown below and send it to Muse with your PDF.'); }
  }
  function next(e) {
    e.preventDefault(); setError('');
    if (step === 0 && agent === 'own' && !agentName.trim()) { setError('Enter your agent’s name to continue.'); return; }
    if (step < 2) { setStep(step + 1); return; }
    try { localStorage.setItem('job-board-onboarding', JSON.stringify({ agent, agentName: agentName.trim(), profileSource: source, name: name.trim(), introduction: intro.trim() })); setDone(true); }
    catch { setError('Your setup could not be saved. Allow browser storage and try again.'); }
  }
  return <div className="onboarding">
    <header><Link href="/" className="brand"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 16 5-7 4 5 7-9M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Job Signal Board</Link><span className="muted">Your setup</span></header>
    {done ? <section className="completion" aria-live="polite"><h1>You’re ready{name.trim() ? `, ${name.trim()}` : ''}.</h1><p>Your preferences and introduction are saved in this browser.</p><Link className="primary" href="/profile/">Go to your profile</Link></section> : <>
      <ol className="progress" aria-label="Setup progress">{steps.map((title, i) => <li key={title} aria-current={i === step ? 'step' : undefined} className={i <= step ? 'active' : ''}><span>{i + 1}</span>{title}</li>)}</ol>
      <form onSubmit={next}>
        {step === 0 && <><h1>A little help.<br />A better job search.</h1><p>Choose your own agent or use the platform’s suggestions. You’re in control of what comes next.</p><fieldset><legend>Who will help with your search?</legend>{[['platform', 'Use platform suggestions', 'Start with guided recommendations.'], ['own', 'Bring my own agent', 'Use an agent you already work with.']].map(([value, title, text]) => <label className={`choice ${agent === value ? 'selected' : ''}`} key={value}><input type="radio" name="agent" checked={agent === value} onChange={() => setAgent(value)} /><span><strong>{title}</strong><small>{text}</small></span></label>)}</fieldset>{agent === 'own' && <label className="field">Agent name<input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="My career assistant" maxLength={100} /><small>We’ll save your preference. Connecting your agent is a separate step.</small></label>}<p className="note">A starting point, not a commitment.<br />You can change your preferences later.</p></>}
        {step === 1 && <><h1>Your profile.<br />Less busywork.</h1><p>Start with your resume or a Simplify profile PDF. Ask Muse to fill the board, then review the extracted details.</p><fieldset><legend>How would you like to get started?</legend>{[['muse', 'Use Muse with a PDF', 'Bring your resume or Simplify profile PDF.'], ['manual', 'I’ll fill it out myself', 'Add your details at your own pace.']].map(([value, title, text]) => <label key={value} className={`choice ${source === value ? 'selected' : ''}`}><input type="radio" name="source" checked={source === value} onChange={() => setSource(value)} /><span><strong>{title}</strong><small>{text}</small></span></label>)}</fieldset>{source === 'muse' && <div className="provider"><p>Send your PDF to Muse with this request. Extracted facts should be saved as <strong>unverified</strong>, missing facts left blank, and reviewed before use in applications.</p><blockquote className="muse-request">{musePrompt}</blockquote><button type="button" className="back" onClick={copyMusePrompt}>{copied ? 'Request copied' : 'Copy request for Muse'}</button><p className="note" role="status">{copied ? 'Paste the request into Muse and attach your PDF.' : 'This preview saves your setup choice. PDF extraction runs through Muse, outside this page.'}</p></div>}</>}
        {step === 2 && <><h1>Let’s start<br />with you.</h1><p>A quick introduction gives your search a personal starting point.</p><label className="field">What should we call you?<input required autoComplete="given-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Your first name" /></label><label className="field">A little about you <span className="muted">(optional)</span><textarea rows={4} maxLength={600} value={intro} onChange={e => setIntro(e.target.value)} placeholder="What do you do, and what are you looking for next?" /><small>A sentence or two is plenty. {intro.length}/600</small></label><p className="note">This setup is saved on this device.</p></>}
        {error && <p role="alert" className="error">{error}</p>}
        <footer>{step > 0 && <button type="button" className="back" onClick={() => {setStep(step - 1); setError('');}}>Back</button>}<button type="submit" className="primary">{step === 2 ? 'Finish setup' : 'Continue'}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button><span className="count">{step + 1} of 3</span></footer>
      </form>
    </>}
  </div>;
}
