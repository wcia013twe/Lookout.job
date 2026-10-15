import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile);
export const command = async (file, args, cwd = process.cwd()) => (await exec(file, args, { cwd, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();

export function normalizeCloneRemote(remote) {
  const scpMatch = remote.match(/^git@github\.com:(.+)$/);
  const sshMatch = remote.match(/^ssh:\/\/git@github\.com\/(.+)$/);
  const repository = scpMatch?.[1] || sshMatch?.[1];
  if (!repository) return remote;
  return `https://github.com/${repository.replace(/\.git$/, '')}.git`;
}

export async function diagnoseEnvironment({ run = command, platform = process.platform, nodeVersion = process.version, tempDirectory = tmpdir() } = {}) {
  const checks = [
    ['Git', 'git', ['--version']],
    platform === 'win32'
      ? ['npm', process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --version']]
      : ['npm', 'npm', ['--version']],
  ];
  const failures = [];
  for (const [label, file, args] of checks) {
    try { await run(file, args); }
    catch { failures.push(label); }
  }
  const [major = 0, minor = 0] = nodeVersion.replace(/^v/, '').split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 9)) failures.push(`Node.js 20.9+ (found ${nodeVersion})`);
  if (failures.length) {
    throw Error(`Feature environment is not ready. Missing or unavailable: ${failures.join(', ')}. Install Node.js LTS with npm and Git on PATH; do not substitute pnpm for this npm-managed repository.`);
  }
  return `Feature environment ready. Node ${nodeVersion}; checkout parent ${join(tempDirectory, 'lookout-features')}`;
}

export function fragmentName(branch) {
  const name = branch.replace(/^codex\//, '');
  return /^[A-Za-z0-9-]+$/.test(name) ? name + '.md' : null;
}
export async function validateFragment(branch, read = readFile, baseDirectory = process.cwd()) {
  const name = fragmentName(branch);
  if (!name) return; // Existing manually named branches keep their old contract.
  let content;
  try { content = await read(join(baseDirectory, 'changes', name), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (content.includes('<!-- change-fragment: draft -->') || content.trim().length < 20 || !/^#\s+\S/m.test(content)) throw Error('Complete and commit the generated change fragment before delivery.');
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

export async function landFeature({ run = command, readFragment = readFile, readMetadata = readFile, checkout = process.cwd() } = {}) {
  const branch = await run('git', ['branch', '--show-current'], checkout);
  if (!branch.startsWith('codex/')) throw Error('Land from a codex/ feature branch, never main.');
  if (await run('git', ['status', '--porcelain'], checkout)) throw Error('Commit only the intended feature files before landing. The feature checkout must be clean.');
  await validateFragment(branch, readFragment, checkout);

  const gitDirectory = await run('git', ['rev-parse', '--git-dir'], checkout);
  const metadataPath = join(isAbsolute(gitDirectory) ? gitDirectory : resolve(checkout, gitDirectory), 'codex-feature.json');
  let metadata;
  try { metadata = JSON.parse(await readMetadata(metadataPath, 'utf8')); }
  catch { throw Error('This checkout has no local delivery metadata. Start it with feature:start before using feature:land.'); }
  const source = metadata.sourceCheckout;
  if (!source) throw Error('The feature checkout does not identify its shared main checkout.');
  if (await run('git', ['branch', '--show-current'], source) !== 'main') throw Error('The shared checkout must be on main before landing a feature.');

  await run('git', ['fetch', source, 'main'], checkout);
  try { await run('git', ['merge', '--no-edit', 'FETCH_HEAD'], checkout); }
  catch { throw Error('Local main could not be integrated. Resolve the conflict in this feature checkout, rerun relevant checks, commit, and rerun feature:land.'); }

  await run('git', ['fetch', checkout, branch], source);
  try { await run('git', ['merge', '--ff-only', 'FETCH_HEAD'], source); }
  catch { throw Error('Local main changed or has overlapping local edits. Preserve those edits, integrate the latest local main in the feature checkout, and rerun feature:land.'); }
  return `Landed ${branch} in local main at ${source}`;
}

export async function startFeature(name, run = command, sourceDirectory = process.cwd()) {
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(name || '')) throw Error('Use a short lowercase feature name with hyphens.');
  await diagnoseEnvironment({ run });
  const sourceCheckout = await run('git', ['rev-parse', '--show-toplevel'], sourceDirectory);
  if (await run('git', ['branch', '--show-current'], sourceCheckout) !== 'main') throw Error('Run feature:start from the shared main checkout.');
  const sourceMainCommit = await run('git', ['rev-parse', 'HEAD'], sourceCheckout);
  const originalRemote = await run('git', ['remote', 'get-url', 'origin'], sourceCheckout);
  const parent = join(tmpdir(), 'lookout-features');
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, name + '-'));
  const checkout = join(path, 'repo');
  // Clone committed local main so finished local work is immediately available to the next task.
  // Existing destinations fail safely rather than being reset or overwritten.
  try { await run('git', ['clone', '--no-local', '--single-branch', '--branch', 'main', sourceCheckout, checkout]); }
  catch (error) { throw Error(`Could not create the isolated checkout at ${checkout}. Ensure the agent may write Git metadata under ${parent}, then rerun feature:start. ${error.message}`); }
  await run('git', ['remote', 'set-url', 'origin', originalRemote], checkout);
  const branch = `codex/${basename(path)}`;
  await run('git', ['switch', '-c', branch], checkout);
  await mkdir(join(checkout, '.git'), { recursive: true });
  await writeFile(join(checkout, '.git', 'codex-feature.json'), JSON.stringify({ sourceCheckout, sourceMainCommit }, null, 2) + '\n');
  await mkdir(join(checkout, 'changes'), { recursive: true });
  await writeFile(join(checkout, 'changes', fragmentName(branch)), `# ${name}\n\n<!-- change-fragment: draft -->\n\n- Describe the completed change.\n- Validation: record checks actually run.\n- Limits: record any unverified behavior.\n`);
  return checkout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' }, 'body-file': { type: 'string' } } });
  try {
    if (positionals[0] === 'doctor') console.log(await diagnoseEnvironment());
    else if (positionals[0] === 'start') console.log(await startFeature(positionals[1]));
    else if (positionals[0] === 'land') console.log(await landFeature());
    else if (positionals[0] === 'publish') console.log(await publishFeature({ title: values.title, bodyFile: values['body-file'] }));
    else if (positionals[0] === 'status') console.log(await command('gh', ['pr', 'list', '--base', 'main', '--state', 'open', '--json', 'number,title,headRefName,isDraft,labels,statusCheckRollup,url']));
    else throw Error('Use doctor, start <name>, land, publish --title <title> --body-file <path>, or status.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
