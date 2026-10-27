import {GRAPH_TOOL,validateGraphArgs,expandEvidenceGraph} from './evidence-graph.ts';
import type {SourceKey} from './types.ts';
import {METADATA_TOOL,validateMetadataArgs} from './metadata.ts';
import {createServer} from 'node:http';
import type pg from 'pg';
import type {EmbeddingProvider, SourceLoader,StoreTarget} from './types.ts';
import {databaseStore, lockedIngest} from './store.ts';
import {clean} from './clean.ts';
import {ingest,validVector} from './pipeline.ts';
import {INGEST_TOOL, SEARCH_TOOL, MIN_SEARCH_SIMILARITY, validateDemoCall, type DemoCall} from './contract.ts';
export {INGEST_TOOL, LIST_TOOL} from './contract.ts';

// Internal backend API: no fixture imports, MCP names or demo storage defaults.
export function intelligenceProcessor(pool: pg.Pool, provider: EmbeddingProvider|undefined, loadSources: SourceLoader, target:StoreTarget) {
  return {
    graph: async (args:unknown) => {
      const options=validateGraphArgs(args);
      const store=databaseStore((sql,values)=>pool.query(sql,values),target);
      const readCurrent=async(keys:SourceKey[],circleId?:string)=>{
        const candidates=await loadSources();
        const matches=candidates.filter(c=>keys.some(k=>k.sourceType===c.observation.sourceType&&k.sourceId===c.observation.sourceId)&&(!circleId||c.sourceCircleId===circleId));
        const current=matches.map(c=>clean(c.observation,null,c.identities));
        const eligible:SourceKey[]=[];
        for(const r of current){
          const saved=await store.get(r.sourceType,r.sourceId);
          if(saved?.content_hash===r.contentHash&&saved.processing_version===r.processingVersion)eligible.push({sourceType:r.sourceType,sourceId:r.sourceId});
        }
        return eligible.length?store.list(eligible.length,current,undefined,{sourceKeys:eligible}):[];
      };
      const seeds=await readCurrent(options.seeds);
      return expandEvidenceGraph(seeds,async ref=>{
        const rows=await readCurrent([{sourceType:'circle_post',sourceId:ref.postId}],ref.circleId);
        return rows[0]??null;
      },options);
    },
    metadata: async (args:unknown) => {
      const {limit,...filters}=validateMetadataArgs(args);
      const current=target.kind==='account'?(await loadSources()).map(c=>clean(c.observation,null,c.identities)):undefined;
      const items=await databaseStore((sql,values)=>pool.query(sql,values),target).list(limit,current,undefined,filters);
      return {items,filters,order:'reported_date_desc',limit};
    },
    search: async (query:string,limit=5,mode:'vector'|'hybrid'='vector') => {
      validateDemoCall(SEARCH_TOOL,{query,limit,mode});
      if(!provider)throw Error('EMBEDDING_PROVIDER_REQUIRED');
      const vector=await provider.embed(query.trim());
      if(!validVector(vector))throw Error('INVALID_VECTOR');
      // Refresh permissions after the network request, immediately before selection.
      const current=(await loadSources()).map(c=>clean(c.observation,null,c.identities));
      const items=await databaseStore((sql,values)=>pool.query(sql,values),target).list(limit,current,{vector,model:provider.model,minSimilarity:MIN_SEARCH_SIMILARITY,mode,query});
      return {items,embeddingModel:provider.model,minSimilarity:MIN_SEARCH_SIMILARITY,mode};
    },
    run: () => lockedIngest(pool, async store => ({
      embeddingModel: provider?.model ?? null,
      ...await ingest(store, provider, await loadSources()),
    }), target),
    list: async (limit=20) => {
      const current=target.kind==='account'
        ? (await loadSources()).map(c=>clean(c.observation,null,c.identities)) : undefined;
      return databaseStore((sql, values) => pool.query(sql, values),target).list(limit,current);
    },
  };
}

// Local evaluation transport only. Production callers must authenticate and select owner server-side.
export function ingestionService(pool: pg.Pool, provider: EmbeddingProvider|undefined, loadSources: SourceLoader,target:StoreTarget): DemoCall {
  const processor=intelligenceProcessor(pool,provider,loadSources,target);
  return async (operation, args = {}) => {
    if(operation===GRAPH_TOOL)return processor.graph(args);
    const call = validateDemoCall(operation, args);
    if(call.operation===METADATA_TOOL)return processor.metadata(call.metadata);
    if(call.operation===SEARCH_TOOL)return processor.search(call.query!,call.limit??5,call.mode);
    return call.operation === INGEST_TOOL ? processor.run() : {items:await processor.list(call.limit??20)};
  };
}

export function httpServer(call: DemoCall) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.headers.origin) throw Error('BROWSER_REQUEST_DENIED');
      if (req.method === 'GET' && req.url === '/healthz') {
        res.end(JSON.stringify({demo: true}));
        return;
      }
      if (req.method !== 'POST' || req.url !== '/demo/intelligence') {
        res.writeHead(404).end('{}');
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) throw Error('REQUEST_TOO_LARGE');
        chunks.push(Buffer.from(chunk));
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw Error('INVALID_REQUEST'); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
          Object.keys(payload).some(key => !['operation', 'arguments'].includes(key))) {
        throw Error('INVALID_REQUEST');
      }
      res.end(JSON.stringify(await call(payload.operation, payload.arguments)));
    } catch (error) {
      const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'BACKEND_FAILED';
      res.writeHead(code === 'BACKEND_FAILED' ? 503 : 400).end(JSON.stringify({error: code}));
    }
  });
}
