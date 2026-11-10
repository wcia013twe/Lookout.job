'use client';
import {useEffect,useState} from 'react';
import {useWorkspace} from '../../../lib/workspace.jsx';
import {createOAuthConsentDemo,isTopLevelConsent} from '../../../../lib/oauth-consent.mjs';
import {AGENT_MCP_URL} from '../../../lib/agent-connection-handoff.mjs';

export default function OAuthConsent(){
 const {client,accountUser,demo,authReady}=useWorkspace();
 const [topLevel,setTopLevel]=useState(false);
 const [ticket,setTicket]=useState(''),[details,setDetails]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const origin=new URL(AGENT_MCP_URL).origin;
 useEffect(()=>{setTopLevel(isTopLevelConsent(window));if(!authReady)return;const value=new URLSearchParams(location.hash.slice(1)).get('ticket');if(value)setTicket(value);history.replaceState(null,'',location.pathname);},[authReady]);
 async function request(body){
 if(!isTopLevelConsent(window))throw Error('Open connection consent in its own browser tab.');
 if(demo||!client||!accountUser)throw Error('Sign in to Lookout with your own account first.');
 const {data}=await client.auth.getSession();if(!data.session?.access_token)throw Error('Sign in to Lookout first.');
 const response=await fetch(origin+'/oauth/consent',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({ticket,...body}),redirect:'error'});
 const value=await response.json();if(!response.ok)throw Error(value.error||'Consent unavailable');return value;
 }
 async function load(){setBusy(true);setError('');try{setDetails(demo?createOAuthConsentDemo():await request({action:'read'}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function decide(action,connection){setBusy(true);setError('');try{
 if(!isTopLevelConsent(window))throw Error('Open connection consent in its own browser tab.');if(demo){setError('Demo only: no access was granted.');setBusy(false);return;}
 const result=await request({action,connectionId:connection?.id,scopes:connection?.scopes,expiresAt:connection?.expiresAt});const target=new URL(result.redirect);
 if(target.origin!==origin||!/^\/oauth\/interaction\/[^/]+\/finish$/.test(target.pathname))throw Error('Invalid completion destination');location.assign(target.href);
 }catch(e){setError(e.message);setBusy(false);}}
 return <main className="mx-auto max-w-2xl space-y-5 p-8"><h1 className="text-2xl font-semibold">Connect ChatGPT to Lookout</h1>
 <p>Choose an existing agent connection. ChatGPT can use its listed permissions until the displayed expiry. This permits background access and event notifications; it does not approve applications or other human-only actions.</p>
 {!topLevel&&<p>Open this consent page in its own browser tab.</p>}
 {demo&&<p>Fictional preview. These controls never create a connection or grant access.</p>}
 {!accountUser&&!demo&&<p>Sign in to Lookout, then return to this page from ChatGPT connection setup.</p>}
 {!details&&<button disabled={busy||!topLevel||(!ticket&&!demo)} onClick={load}>Review my connections</button>}
 {details?.connections.map(c=><section key={c.id} className="space-y-2 rounded border p-4"><h2>{c.name}</h2><p>{c.scopes.join(', ')}</p><p>Access expires: {c.expiresAt}</p><button disabled={busy||!topLevel} onClick={()=>decide('approve',c)}>Allow this connection</button></section>)}
 {details?.connections.length===0&&<p>No active connection is available. Create or review one in Lookout connection settings, then restart setup.</p>}
 <button disabled={busy||!topLevel||(!ticket&&!demo)} onClick={()=>decide('deny')}>Cancel connection</button>
 {error&&<p role="alert">{error}</p>}
 </main>;
}
