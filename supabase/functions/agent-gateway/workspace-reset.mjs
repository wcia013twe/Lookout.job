export const RESET_HANDOFF_TOOL={name:'open_workspace_reset',operation:'workspace.reset_handoff',scope:'workspace:read',readOnly:true,
 description:'Open the human-only workspace reset screen. Deletes private workspace records and files only after the signed-in human previews and confirms. Keeps login and Circle content. Agents cannot confirm or execute deletion.',
 inputSchema:{type:'object',properties:{},required:[],additionalProperties:false}};
export const resetHandoff={humanActionRequired:true,action:'reset_workspace',url:'https://wcia013twe.github.io/codex-automated-job-board/workspace-reset/',message:'Sign in, review what will be deleted, then confirm in the reset screen. This tool has not reset anything.'};
