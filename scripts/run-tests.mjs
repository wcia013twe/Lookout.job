// One disposable migrated baseline per run; every test still gets its own DB.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createTestDatabase} from '../tests/helpers/database.mjs';

const directory=await mkdtemp(join(tmpdir(),'lookout-tests-'));
try {
  // Never reuse an inherited snapshot: this run must replay current source.
  delete process.env.LOOKOUT_TEST_DATABASE_SNAPSHOT;
  const db=await createTestDatabase();
  const snapshot=join(directory,'database.tar');
  try { await writeFile(snapshot,new Uint8Array(await (await db.dumpDataDir('none')).arrayBuffer())); }
  finally { await db.close(); }
  const child=spawn(process.execPath,['--test','--test-concurrency=4',...process.argv.slice(2)],{
    stdio:'inherit',env:{...process.env,LOOKOUT_TEST_DATABASE_SNAPSHOT:snapshot},
  });
  const interrupt=()=>child.kill('SIGINT'),terminate=()=>child.kill('SIGTERM');
  process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
  try {
    process.exitCode=await new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('exit',(code,signal)=>resolve(code??(signal==='SIGINT'?130:1)));
    });
  } finally { process.off('SIGINT',interrupt);process.off('SIGTERM',terminate); }
} finally { await rm(directory,{recursive:true,force:true}); }
