import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyLogoUrl } from '../next-app/lib/company-logo.ts';
import { demoFixtures } from '../next-app/lib/demo.mjs';

const token = 'pk_test_only';
test('company aliases reuse an employer domain rather than an ATS or guessed domain', () => {
  const url = new URL(companyLogoUrl('  Amazon/AWS  ', token));
  assert.equal(url.origin, 'https://img.logo.dev');
  assert.equal(url.pathname, '/aws.amazon.com');
  assert.equal(url.searchParams.get('token'), token);
  assert.equal(url.searchParams.get('fallback'), '404');
  assert.equal(companyLogoUrl('Amazon/AWS', token), companyLogoUrl('AWS', token));
  assert.equal(new URL(companyLogoUrl('NVIDIA', token)).pathname, '/nvidia.com');
});
test('unmapped names are encoded as one name lookup, never interpreted as URLs', () => {
  const name = 'An Unknown Brand & Co / research?token=bad#x';
  const url = new URL(companyLogoUrl(name, token));
  assert.equal(url.origin, 'https://img.logo.dev');
  assert.equal(decodeURIComponent(url.pathname.slice('/name/'.length)), name);
  assert.equal(url.searchParams.get('token'), token);
  assert.equal(url.hash, '');
  assert.equal(new URL(companyLogoUrl('__proto__', token)).pathname, '/name/__proto__');
});
test('missing keys, accidental secret keys, empty names and fictional companies stay local', () => {
  for (const key of ['', undefined, '  ', 'sk_secret']) assert.equal(companyLogoUrl('Stripe', key), null);
  for (const name of ['', ' ', undefined, 'Example Systems (demo)']) assert.equal(companyLogoUrl(name, token), null);
});
test('demo reset preserves real-brand coverage and fictional names skip provider', () => {
 const first = demoFixtures('2026-10-22');
 assert.ok(first.roles.some(role => companyLogoUrl(role.company, token)?.includes('img.logo.dev/')));
 assert.equal(companyLogoUrl('Example Compute (demo)', token), null);
 first.roles.pop();
 assert.ok(demoFixtures('2026-10-22').roles.length > first.roles.length);
});
