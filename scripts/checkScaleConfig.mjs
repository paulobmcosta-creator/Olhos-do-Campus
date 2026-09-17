#!/usr/bin/env node
/**
 * G09B-F003 / G09G6R-F002 — Guard de maxScale (Scale-Out Security Invariant)
 *
 * Verifica que a configuração canônica de deploy (scripts/deployCloudRun.sh)
 * e o pipeline (cloudbuild.yaml) não violam a invariante de segurança:
 * max-instances=1 enquanto o rate limiting for INSTANCE_LOCAL.
 *
 * Regra:
 *   - Configuração canônica DEVE especificar explicitamente max-instances=1
 *   - Se max-instances estiver ausente / não especificado → exit(1) (FAIL-CLOSED: Cloud Run default é 100)
 *   - Se max-instances > 1 sem estratégia distribuída/edge → exit(1) (REGRESSÃO)
 *   - Se max-instances === 1 → PASS
 *
 * Uso:
 *   node scripts/checkScaleConfig.mjs
 *   npm run check:scale
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Constantes de saída ────────────────────────────────────────────────────
const INVARIANT_LABEL    = 'MAX_SCALE_1_SECURITY_INVARIANT=YES';
const SCALE_OUT_ALLOWED  = 'SCALE_OUT_ALLOWED=NO';
const SCALE_PREREQ       = 'SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT';

const DEPLOY_SCRIPT_PATH = join(ROOT, 'scripts', 'deployCloudRun.sh');
const CLOUDBUILD_PATH    = join(ROOT, 'cloudbuild.yaml');

// ─── Verifica existência do script canônico de deploy ───────────────────────
if (!existsSync(DEPLOY_SCRIPT_PATH)) {
  console.error('[check:scale] ERRO: Script canônico de deploy não encontrado:', DEPLOY_SCRIPT_PATH);
  process.exit(1);
}

let deployScriptText = '';
try {
  deployScriptText = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
} catch (err) {
  console.error('[check:scale] ERRO ao ler script de deploy:', err.message);
  process.exit(2);
}

let cloudbuildText = '';
if (existsSync(CLOUDBUILD_PATH)) {
  try {
    cloudbuildText = readFileSync(CLOUDBUILD_PATH, 'utf-8');
  } catch (err) {
    console.error('[check:scale] ERRO ao ler cloudbuild.yaml:', err.message);
    process.exit(2);
  }
}

// ─── Extrai max-instances explicitamente ──────────────────────────────────────
const maxScalePattern = /(?:max-instances|maxScale|MAX_INSTANCES)\s*[=:]\s*["']?(\d+)["']?/gi;

function extractMaxScale(text) {
  let match;
  let highest = null;
  const regex = new RegExp(maxScalePattern.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    const val = parseInt(match[1], 10);
    if (highest === null || val > highest) {
      highest = val;
    }
  }
  return highest;
}

const deployMaxScale = extractMaxScale(deployScriptText);
const cloudbuildMaxScale = extractMaxScale(cloudbuildText);

// ─── Detecta estratégia distribuída / edge ──────────────────────────────────
const distributedPatterns = [
  /RATE_LIMIT_SCOPE\s*[=:]\s*DISTRIBUTED/i,
  /CLOUD_ARMOR_ENABLED\s*[=:]\s*(?:true|yes|1)/i,
  /RATE_LIMIT_BACKEND\s*[=:]\s*(?:redis|memorystore|cloudarmor)/i,
  /DISTRIBUTED_RATE_LIMIT\s*[=:]\s*(?:true|yes|1)/i,
  /EDGE_RATE_LIMIT\s*[=:]\s*(?:true|yes|1)/i,
];

const allConfigText = `${deployScriptText}\n${cloudbuildText}`;
const hasDistributedStrategy = distributedPatterns.some((re) => re.test(allConfigText));

console.log('');
console.log('================================================================');
console.log('  G09B-F003 / G09G6R-F002 — Scale-Out Security Invariant Check');
console.log('================================================================');
console.log('');
console.log('  Configuração deploy: scripts/deployCloudRun.sh');
console.log(`  max-instances deploy: ${deployMaxScale === null ? 'NÃO ESPECIFICADO (VIOLAÇÃO FAIL-CLOSED)' : deployMaxScale}`);
if (cloudbuildMaxScale !== null) {
  console.log(`  max-instances build : ${cloudbuildMaxScale}`);
}
console.log(`  Estratégia distrib.: ${hasDistributedStrategy ? 'DETECTADA' : 'NÃO DETECTADA'}`);
console.log('');
console.log(`  ${INVARIANT_LABEL}`);
console.log(`  ${SCALE_OUT_ALLOWED}`);
console.log(`  ${SCALE_PREREQ}`);
console.log('');

// FAIL-CLOSED: Se max-instances não foi explicitamente definido, FALHA!
// O padrão do Cloud Run é 100 instâncias, o que violaria a invariante de segurança.
if (deployMaxScale === null) {
  console.error('================================================================');
  console.error('  FALHA — MAX-INSTANCES NÃO ESPECIFICADO (FAIL-CLOSED)');
  console.error('================================================================');
  console.error('  O script de deploy scripts/deployCloudRun.sh não especifica');
  console.error('  explicitamente --max-instances=1.');
  console.error('  O Cloud Run assume 100 instâncias por padrão quando omitido.');
  console.error('  A invariante de segurança exige max-instances=1 explícito.');
  console.error('================================================================');
  console.error('');
  process.exit(1);
}

const highestOverall = Math.max(deployMaxScale, cloudbuildMaxScale ?? 0);

if (highestOverall > 1 && !hasDistributedStrategy) {
  console.error('================================================================');
  console.error('  FALHA — REGRESSAO DE SEGURANCA DETECTADA');
  console.error('================================================================');
  console.error(`  max-instances=${highestOverall} > 1 sem rate limiting distribuido/edge.`);
  console.error('');
  console.error('  O rate limiting INSTANCE_LOCAL divide a quota por N');
  console.error('  instâncias, multiplicando o limite efetivo. Isso constitui');
  console.error('  regressão de segurança (G09B-F003 / G09G6R-F002).');
  console.error('');
  console.error('  Para escalar, implante PRIMEIRO:');
  console.error('    * Redis/Memorystore (RATE_LIMIT_SCOPE=DISTRIBUTED), OU');
  console.error('    * Cloud Armor (CLOUD_ARMOR_ENABLED=true)');
  console.error('================================================================');
  console.error('');
  process.exit(1);
}

if (highestOverall > 1 && hasDistributedStrategy) {
  console.log('  STATUS: PASS (scale-out com estratégia distribuída detectada)');
} else {
  console.log('  STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)');
}
console.log('');
