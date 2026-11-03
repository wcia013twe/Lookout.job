import {SUPABASE_URL} from './supabase-config.mjs';
export const AGENT_MCP_URL=process.env.NEXT_PUBLIC_AGENT_MCP_URL || SUPABASE_URL+'/functions/v1/agent-mcp';
export const AGENT_GATEWAY_URL=SUPABASE_URL+'/functions/v1/agent-gateway';

// Sharing instructions must never copy credentials. Secret copy is explicit.
export function connectionClipboardText(token,secureToken=false){
 if(secureToken)return token;
 return `Connect to my Lookout workspace using this MCP endpoint: ${AGENT_MCP_URL}\n\nAsk me to enter my Lookout agent token through your secure credential form or plugin/MCP connection settings. Do not ask me to paste a token or Authorization header into chat.\n\nThis is connection and automation setup only. Use the startup instructions supplied by MCP initialize, then read_developer_context for the canonical Lookout workspace operating guide. Follow its connection_test and automationSetup.schedule procedure, avoiding duplicates. Do not run the tasks now. Verify actual scheduler receipts, then stop. Background watching requires a separate request.\n\nOn later authorized runs follow that same guide: read_muse_changes supplies refresh tool/arguments; read affected records and acknowledge handled event IDs. Refresh the guide when developerVersion changes.`;
}
