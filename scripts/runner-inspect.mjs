import { inspectPublicForm } from '../runner/forms.mjs';

const [url] = process.argv.slice(2);
if (!url) {
  console.error('Usage: node scripts/runner-inspect.mjs https://job-boards.greenhouse.io/company/jobs/123');
  process.exitCode = 1;
} else {
  try { console.log(JSON.stringify(await inspectPublicForm(url), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
