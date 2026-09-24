#!/usr/bin/env node
/**
 * verifyRelease.mjs
 * Verifica a identidade de release 1.0.1 do projeto Olhos do Campus.
 * ES module — sem dependências externas.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const EXPECTED_VERSION = '1.0.1';
const EXPECTED_IMAGE_TAG = `v${EXPECTED_VERSION}`;
const EXPECTED_PROJECT_ID = 'gen-lang-client-0120954905';
const EXPECTED_WORKER_BACKEND_URL = 'https://olhos-do-campus-hnwfymhsqq-uw.a.run.app';

const results = [];
let failed = false;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed = true;
  results.push({ label, actual, expected, ok });
}

function readText(relPath) {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// 1. package.json
try {
  const pkg = JSON.parse(readText('package.json'));
  check('package.json -> version', pkg.version, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'package.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 2. package-lock.json (root metadata, primeiras 15 linhas)
try {
  const lockLines = readText('package-lock.json').split('\n').slice(0, 15).join('\n');
  const rootVersionMatch = lockLines.match(/^\s*"version":\s*"([^"]+)"/m);
  const rootVersion = rootVersionMatch ? rootVersionMatch[1] : null;
  check('package-lock.json -> root version (l.3)', rootVersion, EXPECTED_VERSION);

  const pkgBlockMatch = lockLines.match(/"packages":\s*\{\s*\n\s*"":\s*\{[^}]*?"version":\s*"([^"]+)"/s);
  const pkgBlockVersion = pkgBlockMatch ? pkgBlockMatch[1] : null;
  check('package-lock.json -> packages[""] version (l.9)', pkgBlockVersion, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'package-lock.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 3. src/config/version.ts
try {
  const versionTs = readText('src/config/version.ts');
  const match = versionTs.match(/APP_VERSION\s*=\s*'([^']+)'/);
  const appVersion = match ? match[1] : null;
  check('src/config/version.ts -> APP_VERSION', appVersion, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'src/config/version.ts', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 4. infra/cloudflare/maintenance-worker/package.json
try {
  const mwPkg = JSON.parse(readText('infra/cloudflare/maintenance-worker/package.json'));
  check('maintenance-worker/package.json -> version', mwPkg.version, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'maintenance-worker/package.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 5. infra/cloudflare/maintenance-worker/package-lock.json
try {
  const mwLockLines = readText('infra/cloudflare/maintenance-worker/package-lock.json').split('\n').slice(0, 15).join('\n');
  const rootVersionMatch = mwLockLines.match(/^\s*"version":\s*"([^"]+)"/m);
  const rootVersion = rootVersionMatch ? rootVersionMatch[1] : null;
  check('maintenance-worker/package-lock.json -> root version (l.3)', rootVersion, EXPECTED_VERSION);

  const pkgBlockMatch = mwLockLines.match(/"packages":\s*\{\s*\n\s*"":\s*\{[^}]*?"version":\s*"([^"]+)"/s);
  const pkgBlockVersion = pkgBlockMatch ? pkgBlockMatch[1] : null;
  check('maintenance-worker/package-lock.json -> packages[""] version (l.9)', pkgBlockVersion, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'maintenance-worker/package-lock.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 6. infra/cloudflare/maintenance-worker/src/index.ts (worker runtime version)
try {
  const workerSrc = readText('infra/cloudflare/maintenance-worker/src/index.ts');
  const match = workerSrc.match(/version:\s*['"]([^'"]+)['"]/);
  const runtimeVersion = match ? match[1] : null;
  check('maintenance-worker/src/index.ts -> runtime version', runtimeVersion, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'maintenance-worker/src/index.ts -> runtime version', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 7. cloudbuild.yaml
try {
  const cloudbuild = readText('cloudbuild.yaml');
  const match = cloudbuild.match(/_IMAGE_TAG:\s*(\S+)/);
  const imageTag = match ? match[1] : null;
  check('cloudbuild.yaml -> _IMAGE_TAG', imageTag, EXPECTED_IMAGE_TAG);
} catch (e) {
  failed = true;
  results.push({ label: 'cloudbuild.yaml', actual: `ERRO: ${e.message}`, expected: EXPECTED_IMAGE_TAG, ok: false });
}

// 8. metadata.json
try {
  const meta = JSON.parse(readText('metadata.json'));
  check('metadata.json -> version', meta.version, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'metadata.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 9. firebase-blueprint.json
try {
  const blueprint = JSON.parse(readText('firebase-blueprint.json'));
  check('firebase-blueprint.json -> version', blueprint.version, EXPECTED_VERSION);
} catch (e) {
  failed = true;
  results.push({ label: 'firebase-blueprint.json', actual: `ERRO: ${e.message}`, expected: EXPECTED_VERSION, ok: false });
}

// 10. scripts/deployCloudRun.sh (deploy target project ID)
try {
  const deployScript = readText('scripts/deployCloudRun.sh');
  const match = deployScript.match(/PROJECT_ID="\$\{PROJECT_ID:-([^}]+)\}"/);
  const projectId = match ? match[1] : null;
  check('scripts/deployCloudRun.sh -> PROJECT_ID', projectId, EXPECTED_PROJECT_ID);
} catch (e) {
  failed = true;
  results.push({ label: 'scripts/deployCloudRun.sh -> PROJECT_ID', actual: `ERRO: ${e.message}`, expected: EXPECTED_PROJECT_ID, ok: false });
}

// 11. infra/cloudflare/maintenance-worker/wrangler.jsonc (vars.BACKEND_URL)
try {
  const content = readText('infra/cloudflare/maintenance-worker/wrangler.jsonc');
  const sanitized = content.replace(/^\s*\/\/.*$/gm, '');
  const config = JSON.parse(sanitized);
  const backendUrl = config.vars?.BACKEND_URL;
  if (!backendUrl || backendUrl === 'https://configure-cloud-run-url.example' || backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1') || backendUrl !== EXPECTED_WORKER_BACKEND_URL) {
    failed = true;
    results.push({ label: 'maintenance-worker/wrangler.jsonc -> vars.BACKEND_URL', actual: backendUrl ?? 'UNDEFINED', expected: EXPECTED_WORKER_BACKEND_URL, ok: false });
  } else {
    check('maintenance-worker/wrangler.jsonc -> vars.BACKEND_URL', backendUrl, EXPECTED_WORKER_BACKEND_URL);
  }
} catch (e) {
  failed = true;
  results.push({ label: 'maintenance-worker/wrangler.jsonc -> vars.BACKEND_URL', actual: `ERRO: ${e.message}`, expected: EXPECTED_WORKER_BACKEND_URL, ok: false });
}

// Relatorio
console.log('\n==================================================');
console.log(`  VERIFY RELEASE -- Olhos do Campus v${EXPECTED_VERSION}`);
console.log(`  Truth points verificados: ${results.length}`);
console.log('==================================================');

for (const r of results) {
  const status = r.ok ? '[PASS]' : '[FAIL]';
  console.log(`\n${status}  ${r.label}`);
  console.log(`       expected : ${r.expected}`);
  console.log(`       actual   : ${r.actual}`);
}

console.log('\n==================================================');
const verdict = failed ? 'RELEASE_IDENTITY_TEST=FAIL' : 'RELEASE_IDENTITY_TEST=PASS';
console.log(`  ${verdict}`);
console.log('==================================================\n');

if (failed) process.exit(1);