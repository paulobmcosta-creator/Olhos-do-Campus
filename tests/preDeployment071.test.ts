// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareStorageObjects,
  createStorageMigrationVerificationReport,
  migrationHasErrors,
  verificationIsComplete,
  type StorageMigrationVerificationReport,
} from '../scripts/storageMigrationVerification';

function report(overrides: Partial<StorageMigrationVerificationReport>): StorageMigrationVerificationReport {
  return { ...createStorageMigrationVerificationReport(), ...overrides };
}

describe('correções pré-implantação 0.7.1', () => {
  it('cleanup do Artifact Registry alcança versões antigas tagueadas e preserva tags protegidas + 10 recentes', () => {
    const policy = JSON.parse(readFileSync('infra/artifact-registry-cleanup-policy.json', 'utf8')) as Array<Record<string, unknown>>;
    const deletePolicy = policy.find((item) => item.name === 'delete-old-versions');
    const protectedPolicy = policy.find((item) => item.name === 'keep-protected-tags');
    const recentPolicy = policy.find((item) => item.name === 'keep-recent-for-rollback');
    expect(deletePolicy).toMatchObject({ action: { type: 'Delete' }, condition: { tagState: 'any', olderThan: '30d' } });
    expect(protectedPolicy).toMatchObject({ action: { type: 'Keep' }, condition: { tagState: 'tagged' } });
    expect((protectedPolicy?.condition as { tagPrefixes?: string[] }).tagPrefixes).toEqual(expect.arrayContaining(['release-', 'keep-', 'rollback-']));
    expect(recentPolicy).toMatchObject({ action: { type: 'Keep' }, mostRecentVersions: { keepCount: 10 } });
    const simulatedOldAutoTaggedBuilds = Array.from({ length: 100 }, (_, index) => `build-${index.toString().padStart(3, '0')}`);
    expect(simulatedOldAutoTaggedBuilds).toHaveLength(100);
    expect((deletePolicy?.condition as { tagState?: string }).tagState).toBe('any');
  });

  it('verify passa com 100/100 objetos elegíveis presentes', () => {
    const value = report({ listed: 100, eligibleSourceObjects: 100, verified: 100 });
    expect(verificationIsComplete(value)).toBe(true);
    expect(migrationHasErrors(value, true)).toBe(false);
  });

  it('verify falha com 99/100 e um destino ausente', () => {
    const value = report({ listed: 100, eligibleSourceObjects: 100, verified: 99, missingDestination: 1 });
    expect(verificationIsComplete(value)).toBe(false);
    expect(migrationHasErrors(value, true)).toBe(true);
  });

  it('detecta tamanho divergente', () => {
    expect(compareStorageObjects(Buffer.from('1234'), Buffer.from('123'))).toBe('SIZE_MISMATCH');
  });

  it('detecta hash divergente mesmo com tamanho igual', () => {
    expect(compareStorageObjects(Buffer.from('abcd'), Buffer.from('abce'))).toBe('HASH_MISMATCH');
  });

  it('erro transitório contabilizado impede sucesso da verificação', () => {
    const value = report({ listed: 100, eligibleSourceObjects: 100, verified: 99, failures: 1 });
    expect(migrationHasErrors(value, true)).toBe(true);
  });

  it('path rejeitado impede sucesso da verificação', () => {
    const value = report({ listed: 100, eligibleSourceObjects: 99, verified: 99, rejectedPaths: 1 });
    expect(migrationHasErrors(value, true)).toBe(true);
  });

  it('objeto ignorado justificadamente fica fora do denominador elegível', () => {
    const value = report({ listed: 100, eligibleSourceObjects: 99, ignoredJustified: 1, verified: 99 });
    expect(verificationIsComplete(value)).toBe(true);
  });

  it('região, baseline Node e Worker são preservados na linha ativa 1.0.2', () => {
    const cloudbuild = readFileSync('cloudbuild.yaml', 'utf8');
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string; engines?: { node?: string } };
    const workerPackage = JSON.parse(readFileSync('infra/cloudflare/maintenance-worker/package.json', 'utf8')) as { version: string; engines?: { node?: string }; dependencies?: Record<string, string> };
    const workerIndex = readFileSync('infra/cloudflare/maintenance-worker/src/index.ts', 'utf8');
    const dockerfile = readFileSync('Dockerfile', 'utf8');
    expect(cloudbuild).toContain('_REGION: us-west1');
    expect(cloudbuild).not.toContain('_REGION: us-central1');
    expect(cloudbuild).toContain('_REGION é obrigatória.');
    expect(rootPackage).toMatchObject({ version: '1.0.2', engines: { node: '>=22.22.2 <23' } });
    expect(workerPackage).toMatchObject({ version: '1.0.2', engines: { node: '>=22.22.2 <23' } });
    expect(workerIndex).toMatch(/version:\s*['"]1\.0\.1['"]/u);
    expect(workerPackage.dependencies ?? {}).not.toHaveProperty('olhos-do-campus');
    expect(dockerfile.match(/node:22\.22\.2-bookworm-slim/gu)).toHaveLength(2);
  });
});
