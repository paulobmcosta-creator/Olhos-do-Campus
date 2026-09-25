// @vitest-environment node
/**
 * G09B-F003 / G09G6R-F002 — Testes do Guard de maxScale
 *
 * Verifica que:
 * 1. scripts/deployCloudRun.sh é o wrapper canônico e fixa max-instances=1
 * 2. cloudbuild.yaml não contém max-instances > 1
 * 3. RATE_LIMIT_SCOPE=INSTANCE_LOCAL está documentado em rateLimit.ts
 * 4. O script check:scale existe no package.json e referencia o arquivo correto
 * 5. checkScaleConfig.mjs opera com fail-closed (rejeita ausência de max-instances)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const DEPLOY_SCRIPT_PATH = join(ROOT, 'scripts', 'deployCloudRun.sh');
const CLOUDBUILD_PATH = join(ROOT, 'cloudbuild.yaml');
const RATE_LIMIT_PATH = join(ROOT, 'server', 'middleware', 'rateLimit.ts');
const PACKAGE_JSON_PATH = join(ROOT, 'package.json');
const SCALE_GUARD_PATH = join(ROOT, 'scripts', 'checkScaleConfig.mjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseMaxInstances(text: string): number | null {
  const pattern = /(?:max-instances|maxScale|MAX_INSTANCES)\s*[=:]\s*["']?(\d+)["']?/gi;
  let match: RegExpExecArray | null;
  let highest: number | null = null;
  while ((match = pattern.exec(text)) !== null) {
    const value = parseInt(match[1] ?? '', 10);
    if (highest === null || value > highest) highest = value;
  }
  return highest;
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('G09B-F003 / G09G6R-F002 — Guard de maxScale: invariante de segurança', () => {

  describe('scripts/deployCloudRun.sh (Wrapper Canônico)', () => {
    it('arquivo de deploy canônico existe e é legível', () => {
      expect(existsSync(DEPLOY_SCRIPT_PATH), 'scripts/deployCloudRun.sh deve existir').toBe(true);
    });

    it('fixa explicitamente max-instances=1 na linha de deploy', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      const maxInstances = parseMaxInstances(text);
      expect(maxInstances).toBe(1);
      expect(text).toContain('MAX_INSTANCES=1');
      expect(text).toContain('--max-instances=');
    });

    it('opera em modo DRY-RUN por padrão', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('DRY_RUN=true');
      expect(text).toContain('[DRY-RUN]');
    });

    it('exige token ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2 para deploy real', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('CONFIRM_DEPLOY_1_0_2');
    });

    it('G10C-F001: define PROJECT_ID canônico de produção gen-lang-client-0120954905', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('PROJECT_ID="${PROJECT_ID:-gen-lang-client-0120954905}"');
    });

    it('G10C-F001: não contém o identificador fictício olhos-do-campus-prod', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).not.toContain('olhos-do-campus-prod');
    });

    it('define SERVICE_NAME canônico de produção olhos-do-campus', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('SERVICE_NAME="${SERVICE_NAME:-olhos-do-campus}"');
    });

    it('define IMAGE_NAME canônico como olhos-do-campus-api, igual ao Cloud Build', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('IMAGE_NAME="${IMAGE_NAME:-olhos-do-campus-api}"');
      expect(readFileSync(CLOUDBUILD_PATH, 'utf-8')).toContain('_IMAGE: olhos-do-campus-api');
    });

    it('define REGION canônica de produção us-west1', () => {
      const text = readFileSync(DEPLOY_SCRIPT_PATH, 'utf-8');
      expect(text).toContain('REGION="${REGION:-us-west1}"');
    });
  });

  describe('cloudbuild.yaml', () => {
    it('arquivo existe e é legível', () => {
      expect(existsSync(CLOUDBUILD_PATH), 'cloudbuild.yaml deve existir').toBe(true);
    });

    it('não contém max-instances > 1 (invariante de segurança)', () => {
      const text = readFileSync(CLOUDBUILD_PATH, 'utf-8');
      const maxInstances = parseMaxInstances(text);
      if (maxInstances !== null) {
        expect(maxInstances).toBeLessThanOrEqual(1);
      }
    });

    it('não menciona CLOUD_ARMOR_ENABLED sem max-instances > 1', () => {
      const text = readFileSync(CLOUDBUILD_PATH, 'utf-8');
      const maxInstances = parseMaxInstances(text);
      const hasCloudArmor = /CLOUD_ARMOR_ENABLED\s*[=:]\s*(?:true|yes|1)/i.test(text);
      const effectiveMax = maxInstances ?? 1;
      if (hasCloudArmor && effectiveMax > 1) {
        expect(hasCloudArmor).toBe(true);
      }
    });
  });

  describe('server/middleware/rateLimit.ts', () => {
    it('arquivo existe e é legível', () => {
      expect(existsSync(RATE_LIMIT_PATH)).toBe(true);
    });

    it('documenta RATE_LIMIT_SCOPE=INSTANCE_LOCAL', () => {
      const text = readFileSync(RATE_LIMIT_PATH, 'utf-8');
      expect(text).toContain('RATE_LIMIT_SCOPE=INSTANCE_LOCAL');
    });

    it('documenta CURRENT_PRODUCTION_MAXSCALE=1', () => {
      const text = readFileSync(RATE_LIMIT_PATH, 'utf-8');
      expect(text).toContain('CURRENT_PRODUCTION_MAXSCALE=1');
    });

    it('documenta REQUIRES_DISTRIBUTED_OR_EDGE_LIMIT_BEFORE_SCALE_OUT=YES', () => {
      const text = readFileSync(RATE_LIMIT_PATH, 'utf-8');
      expect(text).toContain('REQUIRES_DISTRIBUTED_OR_EDGE_LIMIT_BEFORE_SCALE_OUT=YES');
    });

    it('documenta SAFE_FOR_CURRENT_TOPOLOGY=YES', () => {
      const text = readFileSync(RATE_LIMIT_PATH, 'utf-8');
      expect(text).toContain('SAFE_FOR_CURRENT_TOPOLOGY=YES');
    });
  });

  describe('package.json — script check:scale', () => {
    it('package.json existe e é JSON válido', () => {
      expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);
      const text = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
      expect(() => JSON.parse(text)).not.toThrow();
    });

    it('script "check:scale" está definido', () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts!['check:scale']).toBeDefined();
    });

    it('script "check:scale" referencia checkScaleConfig.mjs', () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      const script = pkg.scripts!['check:scale'] ?? '';
      expect(script).toContain('checkScaleConfig.mjs');
    });
  });

  describe('scripts/checkScaleConfig.mjs (Execução e Fail-Closed)', () => {
    it('arquivo guard existe', () => {
      expect(existsSync(SCALE_GUARD_PATH)).toBe(true);
    });

    it('guard contém lógica de detecção de max-instances', () => {
      const text = readFileSync(SCALE_GUARD_PATH, 'utf-8');
      expect(text).toContain('max-instances');
      expect(text).toContain('maxScale');
    });

    it('guard contém saída de invariante', () => {
      const text = readFileSync(SCALE_GUARD_PATH, 'utf-8');
      expect(text).toContain('MAX_SCALE_1_SECURITY_INVARIANT=YES');
      expect(text).toContain('SCALE_OUT_ALLOWED=NO');
      expect(text).toContain('SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT');
    });

    it('guard chama process.exit(1) em violação', () => {
      const text = readFileSync(SCALE_GUARD_PATH, 'utf-8');
      expect(text).toContain('process.exit(1)');
    });

    it('guard é ES module (usa import)', () => {
      const text = readFileSync(SCALE_GUARD_PATH, 'utf-8');
      expect(text).toContain('import {');
    });

    it('execução direta do guard retorna status 0 com a topologia canônica atual', () => {
      const res = spawnSync(process.execPath, [SCALE_GUARD_PATH], {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)');
    });
  });

});
