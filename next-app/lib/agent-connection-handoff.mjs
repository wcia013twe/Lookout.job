import {SUPABASE_URL} from './supabase-config.mjs';
export const AGENT_MCP_URL=SUPABASE_URL+'/functions/v1/agent-mcp';
export const AGENT_GATEWAY_URL=SUPABASE_URL+'/functions/v1/agent-gateway';

// Sharing instructions must never copy credentials. Secret copy is explicit.
export function connectionClipboardText(token,secureToken=false){
 if(secureToken)return token;
 return `Connect to my Lookout workspace using this MCP endpoint: ${AGENT_MCP_URL}\n\nAsk me to enter my Lookout agent token through your secure credential form or plugin/MCP connection settings. Do not ask me to paste a token or Authorization header into chat.\n\nThis is connection and automation setup only. Call read_onboarding_state, then update_onboarding_step with event connection_test, its current expectedRevision, a stable eventKey and empty data. Read the returned automationSetup.schedule and connectionId. Add or update my enabled scheduled tasks assigned to this connection in your own automation settings, preserving their saved times and timezone and avoiding duplicates. Do not run the tasks now, browse jobs, import data, load career guides or claim queued work. Report the configured schedules and actual scheduler receipts, or the exact blocker, then stop. If no enabled assigned schedules exist or your runtime cannot edit automations, say so and stop. Search starts only on my separate request or a scheduled run.`;
}
