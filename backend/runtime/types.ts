// JSON enters through validated HTTP/RPC boundaries. SQL owns identity and leases.
export type Payload = Record<string, any>;
export type Rpc = (name: string, args: Payload) => Promise<{data: any; error: any}>;
export type Dispatch = (operation: string, payload: Payload) => Promise<any>;
export interface Claim {job: {id: string; kind: string; input: {profileId?: string;applicationId?:string;expectedRevision?:number}; version: number; attempts: number; search_run_id?: string}; credentialHash: string; leaseToken: string}
