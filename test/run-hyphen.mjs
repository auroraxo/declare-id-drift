#!/usr/bin/env node
// Regression test for the env-var name shape. GitHub Actions has historically
// surfaced inputs with hyphens in their names as INPUT_<NAME-WITH-HYPHENS>
// (not INPUT_<NAME_WITH_UNDERSCORES>), and the action's getInput() must accept
// both. This file is run as a separate process by test/run-hyphen.mjs.

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const script = resolve(root, 'src/index.mjs');

// Drive the action with a *hyphenated* env-var shape, exactly as a runner
// would. The agree fixture should still pass (exit 0). If the action's
// getInput() only checks the underscore form, anchor-toml and lib-rs fall
// through to their defaults and Anchor.toml + lib.rs are reported as absent.
const env = {
  ...process.env,
  // Intentionally no INPUT_*_UNDERSCORE versions of these — only the hyphenated shape.
  'INPUT_PROGRAM': 'app',
  'INPUT_CLUSTER': 'mainnet',
  'INPUT_ANCHOR-TOML': resolve(root, 'testdata/agree/Anchor.toml'),
  'INPUT_LIB-RS': resolve(root, 'testdata/agree/programs/app/src/lib.rs'),
  'INPUT-IDL': resolve(root, 'testdata/agree/target/idl/app.json'),
  'INPUT-KEYPAIR': resolve(root, 'testdata/agree/target/deploy/app-keypair.json'),
  'INPUT-FAIL-ON-DRIFT': 'true',
  'INPUT-FAIL-ON-MISSING': 'false',
};
// Wipe the underscore forms if the host env had them, to make the test sharp.
for (const k of Object.keys(env)) {
  if (k.startsWith('INPUT_')) delete env[k];
}
env.INPUT_PROGRAM = 'app';
env.INPUT_CLUSTER = 'mainnet';
env['INPUT_ANCHOR-TOML'] = resolve(root, 'testdata/agree/Anchor.toml');
env['INPUT_LIB-RS'] = resolve(root, 'testdata/agree/programs/app/src/lib.rs');
env['INPUT-IDL'] = resolve(root, 'testdata/agree/target/idl/app.json');
env['INPUT-KEYPAIR'] = resolve(root, 'testdata/agree/target/deploy/app-keypair.json');
env['INPUT-FAIL-ON-DRIFT'] = 'true';
env['INPUT-FAIL-ON-MISSING'] = 'false';

const r = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
const want = 0;
const ok = r.status === want;
console.log(`hyphen-env test: exit ${r.status} (expected ${want}) -> ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) {
  console.log('--- stdout ---');
  console.log(r.stdout);
  console.log('--- stderr ---');
  console.log(r.stderr);
  process.exit(1);
}
// And the underscore form must also work, for backward compatibility.
const env2 = {
  ...process.env,
  INPUT_PROGRAM: 'app',
  INPUT_CLUSTER: 'mainnet',
  INPUT_ANCHOR_TOML: resolve(root, 'testdata/agree/Anchor.toml'),
  INPUT_LIB_RS: resolve(root, 'testdata/agree/programs/app/src/lib.rs'),
  INPUT_IDL: resolve(root, 'testdata/agree/target/idl/app.json'),
  INPUT_KEYPAIR: resolve(root, 'testdata/agree/target/deploy/app-keypair.json'),
  INPUT_FAIL_ON_DRIFT: 'true',
  INPUT_FAIL_ON_MISSING: 'false',
};
const r2 = spawnSync(process.execPath, [script], { env: env2, encoding: 'utf8' });
const ok2 = r2.status === 0;
console.log(`underscore-env test: exit ${r2.status} (expected 0) -> ${ok2 ? 'PASS' : 'FAIL'}`);
if (!ok2) {
  console.log('--- stdout ---');
  console.log(r2.stdout);
  console.log('--- stderr ---');
  console.log(r2.stderr);
  process.exit(1);
}
