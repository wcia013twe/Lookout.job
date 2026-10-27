export const characters = [
  { id: "dot", name: "Dots", company: "OpenAI", image: "dots.svg", animation: null },
  { id: "grok", name: "Grok Bot", company: "xAI", image: "grok-bot.webp", animation: null },
  { id: "muse", name: "Muse", company: "Meta", image: "muse-official.webp", animation: null },
  { id: "claude-duet", name: "Claude Duet", company: "Anthropic", image: "duet.svg", animation: null },
  { id: "hermes", name: "Hermes", company: "Nous Research", image: "hermes-custom.png", animation: null },
  { id: "chatgpt", name: "ChatGPT", company: "OpenAI", image: "chatgpt.svg", animation: null },
  { id: "claude", name: "Claude", company: "Anthropic", image: "claude.svg", animation: null },
  { id: "gemini", name: "Gemini", company: "Google", image: "gemini.png", animation: null },
  { id: "platform", name: "Cappy", company: "Platform agent", image: "lookout-buddy-purple-idle.webp", directory: "brand", animation: null },
];
export const invitedAgents = [{ id: "openclaw", name: "OpenClaw", company: "Your own agent" }];

export const agentOptions = [...characters, ...invitedAgents, {id:"custom",name:"Your agent"}];
export function readAgentSelection(preferences = {}, profile = {}) {
 const saved = preferences.agentSelection;
 const provider = saved?.provider || profile.setupAgentProvider || (profile.setupAgent === "platform" ? "platform" : "muse");
 const option = agentOptions.find(agent => agent.id === provider);
 return {provider: option?.id || "custom", name: saved?.name || profile.setupAgentName || option?.name || "Your agent"};
}
export function saveAgentSelection(store, provider, name) {
 if (!agentOptions.some(agent => agent.id === provider)) throw Error("Choose a supported agent.");
 const selection = {provider, name: String(name || "Your agent").trim().slice(0,100)};
 store.update("workflow.searchPreferences", previous => ({...previous, agentSelection: selection}));
 // Older setup stored UI settings among validated candidate facts. Remove those
 // local-only keys so they cannot block the profile cloud-sync worker.
 const profile = store.get("workflow.profile");
 if (["setupAgent","setupAgentProvider","setupAgentName"].some(key => key in profile)) {
  const {setupAgent,setupAgentProvider,setupAgentName,...facts} = profile;
  store.set("workflow.profile", facts);
 }
 return selection;
}
