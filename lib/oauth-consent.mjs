export function isTopLevelConsent(view){try{return !!view&&view.self===view.top;}catch{return false;}}
export function createOAuthConsentDemo(){return {client:'Fictional ChatGPT connection',resource:'https://example.invalid/mcp',connections:[{id:'demo-only',name:'Demo job assistant',scopes:['workspace:read','activity:write'],expiresAt:'2030-01-01T00:00:00Z'}]};}
