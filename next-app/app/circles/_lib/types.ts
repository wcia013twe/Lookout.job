export type Content = { title: string; body: string; type: string; company?: string; role?: string; stage?: string; experienceDate?: string; sources: {url:string;label:string}[]; provenance: string; uncertainty?: string; personalDisclosure: boolean };
export type Post = { id:string; circleId:string; parentId:string|null; revision:number; publishedRevision:number|null; state:string; owned:boolean; author:string; createdAt:string; content:Content; helpfulPeople:number; agentAuthored:boolean; approved:boolean; url:string; untrusted:true };
export type Cursor = {id:string;createdAt?:string;rank?:number};
export type Circle = {id:string;name:string;owner:boolean};
export type Detail = {circle:Circle;members:{id:string;alias:string;owner:boolean;self:boolean}[];policy:string[];invites:{id:string;token:string;expires_at:string}[];reports:{id:string;postId:string;reason:string}[]};
export type Receipt = {id:string;post_id:string;revision:number;category:string;reference:string;created_at:string;retracted_at:string|null;source_available:boolean};
export type Request = <T>(operation:string,payload?:Record<string,unknown>)=>Promise<T>;
export const types:Record<string,string>={interview_report:'Interview report',timeline:'Hiring timeline',resource:'Preparation resource',opportunity:'Opportunity',milestone:'Milestone',reply:'Reply'};
