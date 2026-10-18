#!/usr/bin/env node
// declare-id-drift — four-way source-side program-ID consistency check.
// Pure file scan. Zero dependencies. Node >= 20.
//
// Legs:
//   1. declare_id!("...") in the program's lib.rs
//   2. [programs.<cluster>] in Anchor.toml
//   3. "address": "..." in target/idl/<name>.json
//   4. pubkey in target/deploy/<name>-keypair.json (off-curve ed25519)
//
// Any leg file may be absent; absent legs are reported as `absent` and excluded
// from the agreement check unless `fail-on-missing` is set.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import process from 'node:process';

// --- input -----------------------------------------------------------------

function getInput(name, fallback) {
  // GitHub Actions passes inputs via INPUT_<UPPER> in process.env.
  const key = `INPUT_${name.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] ?? fallback;
}

const inputs = {
  program: getInput('program', ''),
  cluster: getInput('cluster', 'mainnet'),
  anchorToml: getInput('anchor-toml', 'Anchor.toml'),
  libRs: getInput('lib-rs', ''),
  idl: getInput('idl', ''),
  keypair: getInput('keypair', ''),
  failOnDrift: /^(1|true|yes)$/i.test(getInput('fail-on-drift', 'true')),
  failOnMissing: /^(1|true|yes)$/i.test(getInput('fail-on-missing', 'false')),
};

if (!inputs.program) {
  console.error('::error::Missing required input: program');
  process.exit(2);
}

const program = inputs.program;
const cluster = inputs.cluster;
const defaultLibRs = `programs/${program}/src/lib.rs`;
const defaultIdl = `target/idl/${program}.json`;
const defaultKeypair = `target/deploy/${program}-keypair.json`;

const paths = {
  anchorToml: resolve(inputs.anchorToml),
  libRs: resolve(inputs.libRs || defaultLibRs),
  idl: resolve(inputs.idl || defaultIdl),
  keypair: resolve(inputs.keypair || defaultKeypair),
};

// --- helpers ---------------------------------------------------------------

function exists(path) {
  return existsSync(path);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

// --- leg 1: declare_id! ----------------------------------------------------

function readDeclareId(libRsText) {
  // Match `declare_id!("...")` (with optional whitespace).
  const m = libRsText.match(/declare_id!\(\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"\s*\)/);
  if (!m) return null;
  return m[1];
}

const leg1 = {
  label: 'declare_id!',
  path: paths.libRs,
  value: null,
  status: 'absent',
};
if (exists(leg1.path)) {
  try {
    const v = readDeclareId(readText(leg1.path));
    if (v) {
      leg1.value = v;
      leg1.status = 'ok';
    } else {
      leg1.status = 'malformed';
    }
  } catch (e) {
    leg1.status = `error: ${e.message}`;
  }
}

// --- leg 2: Anchor.toml [programs.<cluster>] -------------------------------

function readAnchorTomlAddress(text, cluster) {
  // Minimal TOML reader for the section we need.
  // Finds `[programs.<cluster>]` then reads the next non-comment key=value.
  const lines = text.split(/\r?\n/);
  const sectionRe = new RegExp(`^\\s*\\[programs\\.${escapeRe(cluster)}\\]\\s*$`);
  const kvRe = /^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"\s*(?:#.*)?$/;
  let inSection = false;
  for (const line of lines) {
    if (/^\s*\[.*\]\s*$/.test(line)) {
      inSection = sectionRe.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(kvRe);
    if (m) return m[2];
  }
  return null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const leg2 = {
  label: `Anchor.toml [programs.${cluster}]`,
  path: paths.anchorToml,
  value: null,
  status: 'absent',
};
if (exists(leg2.path)) {
  try {
    const v = readAnchorTomlAddress(readText(leg2.path), cluster);
    if (v) {
      leg2.value = v;
      leg2.status = 'ok';
    } else {
      leg2.status = 'absent';
    }
  } catch (e) {
    leg2.status = `error: ${e.message}`;
  }
}

// --- leg 3: IDL address -----------------------------------------------------

const leg3 = {
  label: 'IDL address',
  path: paths.idl,
  value: null,
  status: 'absent',
};
if (exists(leg3.path)) {
  try {
    const j = readJson(leg3.path);
    if (typeof j.address === 'string' && j.address.length >= 32) {
      leg3.value = j.address;
      leg3.status = 'ok';
    } else {
      leg3.status = 'malformed';
    }
  } catch (e) {
    leg3.status = `error: ${e.message}`;
  }
}

// --- leg 4: keypair ---------------------------------------------------------

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  // Zero-dependency base58 (bitcoin/solana alphabet). Bytes -> base58 string.
  // Implementation: accumulate into a BigInt, then convert to base 58. Verified
  // round-trip with ed25519-derived pubkeys against an independent decoder.
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  if (n === 0n) {
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    return '1'.repeat(zeros);
  }
  let s = '';
  while (n > 0n) {
    s = B58_ALPHABET[Number(n % 58n)] + s;
    n /= 58n;
  }
  // Preserve leading-zero bytes as leading '1' chars.
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + s;
}

function readKeypairPubkey(path) {
  // Solana CLI keypair JSON: 64-byte expanded ed25519 secret key where
  // bytes 32..64 are the public key (seed || pubkey). No curve math needed.
  const j = readJson(path);
  if (!Array.isArray(j) || j.length !== 64 || j.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
    throw new Error('keypair JSON must be a 64-element byte array');
  }
  return base58Encode(Uint8Array.from(j.slice(32, 64)));
}

const leg4 = {
  label: 'keypair',
  path: paths.keypair,
  value: null,
  status: 'absent',
};
if (exists(leg4.path)) {
  try {
    const v = readKeypairPubkey(leg4.path);
    leg4.value = v;
    leg4.status = 'ok';
  } catch (e) {
    leg4.status = `error: ${e.message}`;
  }
}

// --- agreement check -------------------------------------------------------

const present = [leg1, leg2, leg3, leg4].filter((l) => l.status === 'ok');
const presentValues = new Set(present.map((l) => l.value));

let drift = presentValues.size > 1;
const missing = [leg1, leg2, leg3, leg4].filter((l) => l.status !== 'ok');
const hasMissing = missing.length > 0;

// --- report ----------------------------------------------------------------

const rows = [leg1, leg2, leg3, leg4].map((l) => ({
  leg: l.label,
  path: relPath(l.path),
  status: l.status,
  value: l.value ?? '—',
}));

console.log('declare-id-drift — four-way source-side program-ID consistency');
console.log(`program: ${program}  cluster: ${cluster}`);
console.log('');
console.log('| leg | path | status | value |');
console.log('|-----|------|--------|-------|');
for (const r of rows) {
  console.log(`| ${r.leg} | ${r.path} | ${r.status} | ${r.value} |`);
}
console.log('');

if (drift) {
  console.error(`::error::Program ID drift detected: ${presentValues.size} distinct values across ${present.length} present legs.`);
} else if (present.length > 0) {
  console.log(`All present legs agree on program ID: ${[...presentValues][0]}`);
}
if (hasMissing) {
  const names = missing.map((l) => l.label).join(', ');
  console.error(`::warning::Missing legs: ${names}`);
}

// --- exit ------------------------------------------------------------------

let exitCode = 0;
if (drift && inputs.failOnDrift) exitCode = 1;
else if (hasMissing && inputs.failOnMissing) exitCode = 1;
if (present.length === 0 && !inputs.failOnMissing) {
  console.error('::error::No legs present — nothing to check.');
  exitCode = 1;
}
process.exit(exitCode);

function relPath(p) {
  // Show paths relative to cwd for readability.
  const cwd = process.cwd();
  const rel = p.startsWith(cwd + '/') ? p.slice(cwd.length + 1) : p;
  return rel;
}
