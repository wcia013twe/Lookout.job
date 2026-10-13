import {createClient} from '@supabase/supabase-js';
import {connectCloud} from './cloud.mjs';
// Project URL and publishable key are public configuration, protected by RLS.
const url = 'https://umhqfqzpwmszhcknwtrs.supabase.co';
const key = 'sb_publishable_hWhdwxwVfWS_0zd5VvoFzA_DvfV6jp5';
const client = createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const button = document.querySelector('#account-sign-in');
const signOut = document.querySelector('#account-sign-out');
const message = document.querySelector('#account-status');
let currentUser = null, providerReady = false;
JB.auth = {client, get userId(){return currentUser;}};
function showSession(session) {
  const id = session?.user?.id || null;
  if (id !== currentUser) {
    currentUser = id;
    document.querySelector('#application-review')?.close();
    document.querySelector('pack-opening')?.close(false);
    JB.store.switchAccount(id);
  }
  button.hidden = Boolean(id); signOut.hidden = !id;
  message.textContent = id ? `Signed in as ${session.user.email || 'your Google account'}. Your private account is connected.` : 'Browse jobs without an account. Your current workspace is saved in this browser.';
}
button.addEventListener('click',async () => {
  if (!providerReady) return;
  button.disabled = true;
  // Preserve a morning batch locator, never credentials, across OAuth.
  const redirect = new URL('./',location.href);
  const batch = new URL(location.href).searchParams.get('batch');
  if (batch && /^[0-9a-f-]{36}$/i.test(batch)) redirect.searchParams.set('batch',batch);
  const {error} = await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect.href}});
  if (error) {message.textContent = 'Could not start Google sign-in. Try again.';button.disabled=false;}
});
signOut.addEventListener('click',async () => {
  signOut.disabled=true;
  const {error} = await client.auth.signOut({scope:'local'});
  if (error) message.textContent='Could not sign out. Try again.';
  signOut.disabled=false;
});
connectCloud(client);
// Keep the auth callback synchronous: database requests inside it can deadlock.
client.auth.onAuthStateChange((_event,session) => showSession(session));
try {
  const {data,error} = await client.auth.getSession();
  if (error) throw error;
  showSession(data.session);
  const clean = new URL(location.href);
  ['code','error','error_code','error_description'].forEach(param => clean.searchParams.delete(param));
  if (clean.href !== location.href) history.replaceState(null,'',clean.href);
  const response = await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:'no-store'});
  if (!response.ok) throw new Error('Provider settings unavailable');
  const settings = await response.json(); providerReady = settings.external?.google === true;
  button.disabled = !providerReady;
  if (!providerReady && !currentUser) message.textContent='Google sign-in is not available yet. Your browser workspace remains available.';
} catch {
  button.disabled=true;
  message.textContent='Account sign-in is unavailable. Your browser workspace remains available.';
}
