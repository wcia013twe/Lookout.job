import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile);
export const command = async (file, args, cwd = process.cwd()) => (await exec(file, args, { cwd, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();

export function fragmentName(branch) {
  const name = branch.replace(/^codex\//, '');
  return /^[A-Za-z0-9-]+$/.test(name) ? name + '.md' : null;
}
export async function validateFragment(branch, read = readFile) {
  const name = fragmentName(branch);
  if (!name) return; // Existing manually named branches keep their old contract.
  let content;
  try { content = await read(join('changes', name), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (content.includes('<!-- change-fragment: draft -->') || content.trim().length < 20 || !/^#\s+\S/m.test(content)) throw Error('Complete and commit the generated change fragment before publishing.');
}

export async function publishFeature({ run = command, title, bodyFile, readFragment = readFile }) {
  if (!title?.trim() || !bodyFile) throw Error('Pass --title and --body-file for the reviewable feature.');
  const branch = await run('git', ['branch', '--show-current']);
  if (!branch.startsWith('codex/')) throw Error('Publish from a codex/ feature branch, never main.');
  if (await run('git', ['status', '--porcelain'])) throw Error('Commit only the intended feature files before publishing. The checkout must be clean.');
  await validateFragment(branch, readFragment);
  await run('git', ['fetch', 'origin', 'main']);
  try { await run('git', ['merge', '--no-edit', 'origin/main']); }
  catch { throw Error('Main could not be integrated. Resolve the branch conflict and rerun feature:publish.'); }
  const repo = await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  await run('git', ['push', '-u', 'origin', branch]);
  const existing = JSON.parse(await run('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--base', 'main', '--state', 'open', '--json', 'number,url,isDraft']));
  let pr = existing[0];
  if (!pr) {
    const url = await run('gh', ['pr', 'create', '--repo', repo, '--head', branch, '--base', 'main', '--title', title, '--body-file', bodyFile]);
    pr = JSON.parse(await run('gh', ['pr', 'view', url, '--repo', repo, '--json', 'number,url,isDraft']));
  } else {
    await run('gh', ['pr', 'edit', String(pr.number), '--repo', repo, '--title', title, '--body-file', bodyFile]);
  }
  if (pr.isDraft) await run('gh', ['pr', 'ready', String(pr.number), '--repo', repo]);
  await run('gh', ['pr', 'edit', String(pr.number), '--repo', repo, '--add-label', 'merge-ready']);
  await run('gh', ['workflow', 'run', 'merge-queue.yml', '--repo', repo, '--ref', 'main']);
  return pr.url;
}

export async function startFeature(name, run = command) {
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(name || '')) throw Error('Use a short lowercase feature name with hyphens.');
  const remote = await run('git', ['remote', 'get-url', 'origin']);
  const parent = join(tmpdir(), 'lookout-features');
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, name + '-'));
  const checkout = join(path, 'repo');
  // A fresh clone avoids the shared, cloud-offloaded checkout and its drafts.
  // Existing destinations fail safely rather than being reset or overwritten.
  await run('git', ['clone', '--depth', '1', '--single-branch', '--branch', 'main', remote, checkout]);
  const branch = `codex/${basename(path)}`;
  await run('git', ['switch', '-c', branch], checkout);
  await mkdir(join(checkout, 'changes'), { recursive: true });
  await writeFile(join(checkout, 'changes', fragmentName(branch)), `# ${name}\n\n<!-- change-fragment: draft -->\n\n- Describe the completed change.\n- Validation: record checks actually run.\n- Limits: record any unverified behavior.\n`);
  return checkout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' }, 'body-file': { type: 'string' } } });
  try {
    if (positionals[0] === 'start') console.log(await startFeature(positionals[1]));
    else if (positionals[0] === 'publish') console.log(await publishFeature({ title: values.title, bodyFile: values['body-file'] }));
    else if (positionals[0] === 'status') console.log(await command('gh', ['pr', 'list', '--base', 'main', '--state', 'open', '--json', 'number,title,headRefName,isDraft,labels,statusCheckRollup,url']));
    else throw Error('Use start <name>, publish --title <title> --body-file <path>, or status.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
