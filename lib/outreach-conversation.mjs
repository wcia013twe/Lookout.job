// A versioned presentation of existing private contact notes. No external inbox access.
const marker = 'lookout-conversation-v1';
export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function readConversation(contact) {
  try {
    const data = JSON.parse(contact.notes);
    if (data.format !== marker || typeof data.notes !== 'string' || !Array.isArray(data.messages)) throw Error();
    validateConversation(data);
    return data;
  } catch { return {format:marker,notes:typeof contact.notes === 'string' ? contact.notes : '',url:'',messages:[]}; }
}
export function validateConversation(data) {
  if (!data || data.format !== marker || typeof data.notes !== 'string' || typeof data.url !== 'string' || !Array.isArray(data.messages) || data.messages.length > 50) throw Error('Conversation must contain up to 50 logged messages.');
  if (data.url) { const url = new URL(data.url); if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS conversation link.'); }
  const ids = new Set();
  for (const m of data.messages) {
    if (!m || typeof m.id !== 'string' || !m.id || m.id.length > 100 || ids.has(m.id) || !['sent','received'].includes(m.direction) || !['LinkedIn','Email'].includes(m.channel) || !validDate(m.date) || typeof m.body !== 'string' || !m.body.trim() || m.body.length > 4000) throw Error('Messages need a unique ID, channel, date and text (up to 4,000 characters).');
    ids.add(m.id);
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > 40000) throw Error('Conversation is full. Shorten message summaries before adding another.');
  return data;
}
export function writeConversation(data) { return JSON.stringify(validateConversation(data)); }
export function conversationStage(contact) {
  return readConversation(contact).messages.length || (contact.status && contact.status !== 'Not asked') ? 'ongoing' : 'proposed';
}
export function conversationMessages(contact) {
  return readConversation(contact).messages.map((message,index)=>({...message,index})).sort((a,b)=>a.date.localeCompare(b.date)||a.index-b.index);
}
export function waitingOn(contact) {
  const last = conversationMessages(contact).at(-1);
  return last ? last.direction === 'received' ? 'Your turn to reply' : 'Waiting for reply' : 'History not logged';
}
export function logInteraction(contact, message, url = readConversation(contact).url) {
  const data = readConversation(contact);
  if (data.messages.some(m=>m.id===message.id)) throw Error('This message is already logged.');
  const next = {...data,url,messages:[...data.messages,message]};
  const latest = conversationMessages({notes:writeConversation(next)}).at(-1);
  // Preserve referral/application outcomes; logging does not change application state.
  const status = !contact.status || ['Not asked','Asked','Replied'].includes(contact.status) ? latest.direction === 'received' ? 'Replied' : 'Asked' : contact.status;
  return {notes:writeConversation(next),status};
}
