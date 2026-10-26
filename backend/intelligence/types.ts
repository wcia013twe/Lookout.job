export type ResourceLink = {url:string; label:string};
export type MatchingContext = {label:string; company?:string; role?:string; stage?:string; jobId?:string; jobUrl?:string};
// Existing forum mentions are unpinned pointers, not permission or proof of target contents.
export type PostReference = {circleId:string; postId:string; revision:number|null; label:string};
export type Observation = {
 sourceType:'circle_post'|'application_update'; sourceId:string; sourceRevision:number;
 contentKind?:'observation'|'resource'; title?:string|null; resourceLinks?:ResourceLink[]; contexts?:MatchingContext[]; postReferences?:PostReference[];
 company:string|null; role:string|null; stage:string|null; insight:string; experienceDate:string|null; provenance:string; uncertainty:string|null;
};
export type Report = Observation & {
 contentKind:'observation'|'resource'; title:string|null; resourceLinks:ResourceLink[]; contexts:MatchingContext[]; postReferences:PostReference[];
 contentHash:string; processingVersion:string; embeddingText:string; embeddingModel:string|null;
};
export type Query = (sql:string, values?:any[])=>Promise<{rows:any[]}>;
export type Store = {get:(type:string,id:string)=>Promise<StoredVersion|undefined>; save:(r:Report,vector:number[]|null)=>Promise<void>; list:(limit:number)=>Promise<any[]>};
export type EmbeddingProvider = {model:string; embed:(text:string)=>Promise<number[]>};
export type Candidate = {observation:Observation; identities:string[]};
export type SourceLoader = () => Candidate[] | Promise<Candidate[]>;
export type StoredVersion = {source_revision:number; content_hash:string; processing_version:string; embedding_model:string|null};
export type StoreTarget = {kind:'demo'} | {kind:'account'; ownerId:string};
