import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
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
    ['GitHub CLI', 'gh', ['--version']],
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
    throw Error(`Feature environment is not ready. Missing or unavailable: ${failures.join(', ')}. Install Node.js LTS with npm, Git, and GitHub CLI on PATH; authenticate gh; do not substitute pnpm for this npm-managed repository.`);
  }
  try { await run('gh', ['auth', 'status']); }
  catch { throw Error('GitHub CLI is installed but not authenticated. Run "gh auth login" before starting or publishing a feature.'); }
  return `Feature environment ready. Node ${nodeVersion}; checkout parent ${join(tempDirectory, 'lookout-features')}`;
}

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
  await diagnoseEnvironment({ run });
  const originalRemote = await run('git', ['remote', 'get-url', 'origin']);
  const remote = normalizeCloneRemote(originalRemote);
  const parent = join(tmpdir(), 'lookout-features');
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, name + '-'));
  const checkout = join(path, 'repo');
  // A fresh clone avoids the shared, cloud-offloaded checkout and its drafts.
  // Existing destinations fail safely rather than being reset or overwritten.
  try { await run('git', ['clone', '--depth', '1', '--single-branch', '--branch', 'main', remote, checkout]); }
  catch (error) { throw Error(`Could not create the isolated checkout at ${checkout}. Ensure the agent may write Git metadata under ${parent}, then rerun feature:start. ${error.message}`); }
  if (remote !== originalRemote) await run('git', ['config', 'credential.https://github.com.helper', '!gh auth git-credential'], checkout);
  const branch = `codex/${basename(path)}`;
  await run('git', ['switch', '-c', branch], checkout);
  await mkdir(join(checkout, 'changes'), { recursive: true });
  await writeFile(join(checkout, 'changes', fragmentName(branch)), `# ${name}\n\n<!-- change-fragment: draft -->\n\n- Describe the completed change.\n- Validation: record checks actually run.\n- Limits: record any unverified behavior.\n`);
  return checkout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' }, 'body-file': { type: 'string' } } });
  try {
    if (positionals[0] === 'doctor') console.log(await diagnoseEnvironment());
    else if (positionals[0] === 'start') console.log(await startFeature(positionals[1]));
    else if (positionals[0] === 'publish') console.log(await publishFeature({ title: values.title, bodyFile: values['body-file'] }));
    else if (positionals[0] === 'status') console.log(await command('gh', ['pr', 'list', '--base', 'main', '--state', 'open', '--json', 'number,title,headRefName,isDraft,labels,statusCheckRollup,url']));
    else throw Error('Use doctor, start <name>, publish --title <title> --body-file <path>, or status.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
