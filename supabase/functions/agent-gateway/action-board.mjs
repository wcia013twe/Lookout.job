export const ACTION_BOARD_TOOL = {
 name:'read_action_board',operation:'actions.board.read',scope:'workspace:read',readOnly:true,
 description:'Read deterministic owned human decisions, exact source keys, stopped applications and decision history. Follow each website link for human review. Agents cannot accept, reject, verify or resume work. A rejection stops work, not a request for revision. Approval is not submission; outreach ready is not sent.',
 inputSchema:{type:'object',additionalProperties:false,properties:{}}
};
export function validateActionBoard(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length)throw Error('Board read takes no arguments');
}
