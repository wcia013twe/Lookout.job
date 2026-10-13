import { readFile } from 'node:fs/promises';
import { prepareApprovedFields } from '../runner/prepare.mjs';

const [contextPath, formPath, resumePath] = process.argv.slice(2);
if (!contextPath || !formPath || !resumePath) {
  console.error('Usage: node scripts/runner-prepare.mjs trusted-context.json inspected-form.json resume.pdf');
  process.exitCode = 1;
} else {
  try {
    const context = JSON.parse(await readFile(contextPath, 'utf8'));
    const form = JSON.parse(await readFile(formPath, 'utf8'));
    console.log(JSON.stringify(prepareApprovedFields({ ...context, resumeBytes: await readFile(resumePath) }, form), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
