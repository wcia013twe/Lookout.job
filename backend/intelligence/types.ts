export type Observation = {sourceType:'circle_post'|'application_update'; sourceId:string; sourceRevision:number; company:string; role:string|null; stage:string|null; insight:string; experienceDate:string|null; provenance:string; uncertainty:string|null};
export type Report = Observation & {contentHash:string; processingVersion:string; embeddingText:string; embeddingModel:string};
export type Query = (sql:string, values?:any[])=>Promise<{rows:any[]}>;
export type Store = {get:(type:string,id:string)=>Promise<StoredVersion|undefined>; save:(r:Report,vector:number[])=>Promise<void>; list:(limit:number)=>Promise<any[]>};
export type EmbeddingProvider = {model:string; embed:(text:string)=>Promise<number[]>};
export type Candidate = {observation:Observation; identities:string[]};
export type SourceLoader = () => Candidate[] | Promise<Candidate[]>;
export type StoredVersion = {source_revision:number; content_hash:string; processing_version:string; embedding_model:string};
