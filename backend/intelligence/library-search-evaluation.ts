// Node-only, in-memory evaluation adapter. Not registered with HTTP/MCP or real account loading.
// Orama owns BM25, cosine scoring and hybrid normalization/fusion; no custom scoring here.
import {create,insert,search} from '@orama/orama';
import {stopwords} from '@orama/stopwords/english';
import {validVector} from './pipeline.ts';
export type LibrarySearchMode='bm25'|'vector'|'hybrid';
export async function librarySearchEvaluation(records:{id:string;text:string;embedding:number[];company?:string;role?:string}[]){
 // Orama's English list omits the article 'a'; exclude it to avoid one-letter prefix matches.
 const db=await create({schema:{text:'string',embedding:'vector[1536]',company:'enum',role:'enum'},components:{tokenizer:{language:'english',stemming:true,stopWords:[...stopwords,'a']}}});
 const ids=new Set<string>();
 for(const record of records){
  if(!record.id||ids.has(record.id)||!record.text.trim()||!validVector(record.embedding))throw Error('INVALID_EVALUATION_RECORD');
  ids.add(record.id);
  await insert(db,{id:record.id,text:record.text,company:record.company??'',role:record.role??'',embedding:[...record.embedding]});
 }
 return async(mode:LibrarySearchMode,query:string,embedding?:number[],limit=3,scope?:{company:string;role:string})=>{
  if(!['bm25','vector','hybrid'].includes(mode))throw Error('INVALID_SEARCH_MODE');
  if(typeof query!=='string'||!query.trim()||query.length>1000)throw Error('INVALID_QUERY');
  if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('INVALID_LIMIT');
  if(mode!=='bm25'&&!validVector(embedding))throw Error('INVALID_VECTOR');
  // OR-style keyword recall, library token/prefix matching; built-in English stemming/stopwords.
  const lexical={term:query,properties:['text' as const],threshold:1,exact:false,tolerance:0,relevance:{k:1.2,b:0.75,d:0.5}};
  const vector={property:'embedding',value:embedding??[]};
  const params=mode==='bm25'?{...lexical,mode:'fulltext' as const,limit}
   :mode==='vector'?{mode:'vector' as const,vector,similarity:0.3,limit}
   :{...lexical,mode:'hybrid' as const,vector,similarity:0.3,hybridWeights:{text:0.5,vector:0.5},limit};
  const result=await search(db,{...params,...(scope?{where:{company:{eq:scope.company},role:{eq:scope.role}}}:{})});
  return result.hits.map(hit=>({id:hit.id,score:hit.score}));
 };
}
