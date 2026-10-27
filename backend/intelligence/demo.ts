// Demo composition only: production processing modules do not import these fixtures.
import {pathToFileURL} from 'node:url';
import {demoCandidates, fixtureProvider} from '../../tests/fixtures/intelligence.mts';
import {localPool} from './store.ts';
import {openAIProvider} from './pipeline.ts';
import {scheduleIngestion} from './schedule.ts';
import {ingestionService, httpServer} from './service.ts';
import {INGEST_TOOL} from './contract.ts';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = localPool(process.env.INTELLIGENCE_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/lookout_intelligence_demo');
  const fixtureMode = process.argv.includes('--fixture-vectors') || process.env.INTELLIGENCE_VECTOR_MODE === 'fixture';
  const provider = fixtureMode ? fixtureProvider() : openAIProvider(process.env.OPENAI_API_KEY);
  const call = ingestionService(pool, provider, demoCandidates,{kind:'demo'});

  if (process.argv.includes('--schedule')) {
    const stop = scheduleIngestion(() => call(INGEST_TOOL), result => console.log(JSON.stringify({trigger: 'scheduled', ...result})));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop(); void pool.end(); });
  } else if (process.argv.includes('--once')) {
    try { console.log(JSON.stringify(await call(INGEST_TOOL))); }
    finally { await pool.end(); }
  } else {
    const server = httpServer(call);
    const host = process.env.INTELLIGENCE_HOST || '127.0.0.1';
    server.listen(8091, host, () => console.error(`Intelligence demo backend listening on ${host}:8091`));
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => void pool.end()));
  }
}
