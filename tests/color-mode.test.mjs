import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { parseColorMode, resolveColorMode, colorModeScript } from '../next-app/lib/color-mode.ts';

const trackerCss = readFileSync(new URL('../next-app/components/tracker.css', import.meta.url), 'utf8');

test('theme preferences reject invalid or missing stored values', () => {
  for (const value of [null, undefined, '', 'sepia', {}, '<script>']) assert.equal(parseColorMode(value), 'system');
  for (const value of ['light', 'dark']) assert.equal(parseColorMode(value), value);
});
test('explicit themes override the system while system follows it', () => {
  assert.equal(resolveColorMode('light', true), 'light');
  assert.equal(resolveColorMode('dark', false), 'dark');
  assert.equal(resolveColorMode('system', true), 'dark');
  assert.equal(resolveColorMode('system', false), 'light');
});
function firstPaint(stored, systemDark, blocked=false) {
  const dataset={};
  vm.runInNewContext(colorModeScript, {
    document: { documentElement: { dataset } },
    localStorage: { getItem() { if (blocked) throw Error('Storage disabled'); return stored; } },
    matchMedia: () => ({ matches: systemDark }),
  });
  return dataset;
}
test('first paint honors saved light and dark without waiting for React', () => {
  assert.deepEqual(firstPaint('light',true),{colorMode:'light',theme:'light'});
  assert.deepEqual(firstPaint('dark',false),{colorMode:'dark',theme:'dark'});
});
test('first paint follows system without a valid saved preference', () => {
  assert.deepEqual(firstPaint(null,true),{colorMode:'system',theme:'dark'});
  assert.deepEqual(firstPaint('bad',false),{colorMode:'system',theme:'light'});
});
test('blocked storage still renders the system palette', () => {
  assert.deepEqual(firstPaint(null,true,true),{colorMode:'system',theme:'dark'});
});
test('application tracker scopes its light palette instead of overriding dark mode', () => {
  assert.match(trackerCss, /\.workspace-shell\.tracker-workspace\s*\{[^}]*--color-board-bg:#0b1422[^}]*background:var\(--color-board-bg\)/);
  assert.match(trackerCss, /\[data-theme="light"\] \.workspace-shell\.tracker-workspace\s*\{[^}]*--color-board-bg:#fff/);
  assert.doesNotMatch(trackerCss, /\.tracker-surface\s*\{[^}]*background:#fff/);
  assert.match(trackerCss, /\.tracker-surface\s*\{[^}]*background:var\(--color-board-panel\)/);
});
