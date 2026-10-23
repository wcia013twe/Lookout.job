export const AGENT_MCP_URL='https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp';
export const AGENT_GATEWAY_URL='https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway';

// Sharing instructions must never copy credentials. Secret copy is explicit.
export function connectionClipboardText(token,secureToken=false){
 if(secureToken)return token;
 return `Connect to my Lookout workspace using this MCP endpoint: ${AGENT_MCP_URL}\n\nAsk me to enter my Lookout agent token through your secure credential form or plugin/MCP connection settings. Do not ask me to paste a token or Authorization header into chat.\n\nAfter a successful authenticated read, read the onboarding state and continue my job search within my saved preferences and approval boundaries. Report any connection error before starting.`;
}
