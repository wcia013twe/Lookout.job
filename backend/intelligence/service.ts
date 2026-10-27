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
    search: async (query:string,limit=5) => {
      validateDemoCall(SEARCH_TOOL,{query,limit});
      if(!provider)throw Error('EMBEDDING_PROVIDER_REQUIRED');
      const vector=await provider.embed(query.trim());
      if(!validVector(vector))throw Error('INVALID_VECTOR');
      // Refresh permissions after the network request, immediately before selection.
      const current=(await loadSources()).map(c=>clean(c.observation,null,c.identities));
      const items=await databaseStore((sql,values)=>pool.query(sql,values),target).list(limit,current,{vector,model:provider.model,minSimilarity:MIN_SEARCH_SIMILARITY});
      return {items,embeddingModel:provider.model,minSimilarity:MIN_SEARCH_SIMILARITY};
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
    const call = validateDemoCall(operation, args);
    if(call.operation===SEARCH_TOOL)return processor.search(call.query!,call.limit??5);
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
