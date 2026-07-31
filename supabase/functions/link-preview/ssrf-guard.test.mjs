/**
 * ssrf-guard.test.mjs — checks link-preview's address filter.
 *
 * Run it:  node supabase/functions/link-preview/ssrf-guard.test.mjs
 *
 * The function fetches URLs that users typed, from a server that can see
 * networks a browser cannot. `isPrivateAddress` is the thing standing between
 * that and somebody's cloud metadata endpoint, so it should not be edited on
 * faith.
 *
 * It reads the REAL function out of index.ts rather than keeping a copy here.
 * A copy would drift, pass forever, and prove nothing about the code that runs.
 *
 * Plain Node with no test runner because the repo has none, and a security
 * check that needs infrastructure installed before it can run is a check that
 * stops being run. `node …` and read the last line.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'index.ts'), 'utf8');

const match = src.match(/function isPrivateAddress\(host: string\): boolean \{[\s\S]*?\n\}/);
if (!match) {
  console.error('FAIL — could not find isPrivateAddress in index.ts. Renamed?');
  process.exit(1);
}
const isPrivateAddress = eval(`(${match[0].replace(/: string/g, '').replace(/: boolean/g, '')})`);

/** Must be refused. Anything here reaching fetch() is an SSRF hole. */
const MUST_BLOCK = [
  'localhost', 'foo.localhost', 'db.internal', 'printer.local',
  '127.0.0.1', '127.9.9.9', '0.0.0.0',
  '10.1.2.3', '172.16.5.5', '172.31.255.255', '192.168.1.1',
  '169.254.169.254',            // AWS/GCP metadata — the one that matters most
  '100.64.0.1',                 // carrier-grade NAT
  '224.0.0.1', '255.255.255.255',
  '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1',
  '::ffff:127.0.0.1',           // IPv4 loopback wearing an IPv6 hat
  '::ffff:10.0.0.1',
];

/**
 * Must be allowed. The near misses are the point: 172.32 and 172.15 sit just
 * outside the 172.16–31 private block, and blocking them would mean the guard
 * had been written against whole /8s.
 */
const MUST_ALLOW = [
  'example.com', 'www.eventbrite.com.au', 'warhammer-community.com',
  '8.8.8.8', '1.1.1.1',
  '172.32.0.1', '172.15.0.1', '192.169.0.1', '100.63.0.1',
  '2606:4700:4700::1111',
];

let failures = 0;
for (const host of MUST_BLOCK) {
  if (!isPrivateAddress(host)) { console.log(`LEAK  ${host} was allowed`); failures++; }
}
for (const host of MUST_ALLOW) {
  if (isPrivateAddress(host)) { console.log(`OVER  ${host} was blocked`); failures++; }
}

console.log(
  failures === 0
    ? `ok — ${MUST_BLOCK.length} blocked, ${MUST_ALLOW.length} allowed, 0 wrong`
    : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
