// Optional official draw.io router; install @drawio/mcp outside the app dependencies.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = process.env.DRAWIO_MCP_ROOT;
if (!root) throw new Error('Set DRAWIO_MCP_ROOT to the installed @drawio/mcp package directory.');
const { routeXml } = await import(pathToFileURL(join(root, 'src/libavoid-pass.js')));
const file = join(dirname(fileURLToPath(import.meta.url)), 'lookout-schema.drawio');
const before = await readFile(file, 'utf8');
const after = await routeXml(before);
if (after === before) throw new Error('Routing made no changes; inspect the diagram before delivery.');
await writeFile(file, after.split('\n').map(line => line.trimEnd()).join('\n'));
console.log('Applied official draw.io libavoid routing to all sheets.');
