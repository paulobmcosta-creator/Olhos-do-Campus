// @vitest-environment node
/**
 * G09G6R-F001 — Testes de validação dos scripts de Backup e Restore Firestore
 *
 * Verifica que:
 * 1. firestoreBackup.sh exige FIRESTORE_DATABASE_ID (fail-closed)
 * 2. firestoreBackup.sh inclui --database="..." no comando gcloud firestore export
 * 3. firestoreRestore.sh exige TARGET_FIRESTORE_DATABASE_ID (fail-closed)
 * 4. firestoreRestore.sh inclui --database="..." no comando gcloud firestore import
 * 5. Proteções de segurança (dry-run por padrão, token de confirmação, isolamento)
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const BACKUP_SCRIPT = join(ROOT, 'scripts', 'backup', 'firestoreBackup.sh');
const RESTORE_SCRIPT = join(ROOT, 'scripts', 'backup', 'firestoreRestore.sh');

function getBashPath(): string {
  const gitBashPath = 'C:\\Users\\Extensão - Ifes Bsf\\AppData\\Local\\Programs\\Git\\bin\\bash.exe';
  if (existsSync(gitBashPath)) return gitBashPath;
  return 'bash';
}

function runScript(
  scriptPath: string,
  args: string[] = [],
  envOverrides: Record<string, string | undefined> = {},
) {
  const bash = getBashPath();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete env[k];
    } else {
      env[k] = v;
    }
  }

  return spawnSync(bash, [scriptPath, ...args], {
    env,
    encoding: 'utf-8',
    cwd: ROOT,
  });
}

describe('G09G6R-F001 — Firestore Backup Named Database (--database flag)', () => {
  it('scripts/backup/firestoreBackup.sh existe', () => {
    expect(existsSync(BACKUP_SCRIPT)).toBe(true);
  });

  it('falha (fail-closed) quando FIRESTORE_DATABASE_ID está ausente', () => {
    const result = runScript(BACKUP_SCRIPT, [], {
      FIRESTORE_PROJECT_ID: 'meu-projeto',
      FIRESTORE_DATABASE_ID: undefined,
      BACKUP_BUCKET: 'gs://meu-bucket',
    });
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('FIRESTORE_DATABASE_ID');
  });

  it('falha quando FIRESTORE_PROJECT_ID está ausente', () => {
    const result = runScript(BACKUP_SCRIPT, [], {
      FIRESTORE_PROJECT_ID: undefined,
      FIRESTORE_DATABASE_ID: '(default)',
      BACKUP_BUCKET: 'gs://meu-bucket',
    });
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('FIRESTORE_PROJECT_ID');
  });

  it('falha quando BACKUP_BUCKET não começa com gs://', () => {
    const result = runScript(BACKUP_SCRIPT, [], {
      FIRESTORE_PROJECT_ID: 'meu-projeto',
      FIRESTORE_DATABASE_ID: '(default)',
      BACKUP_BUCKET: 'invalid-bucket-path',
    });
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('gs://');
  });

  it('em dry-run inclui flag --database com o banco informado (default)', () => {
    const result = runScript(BACKUP_SCRIPT, [], {
      FIRESTORE_PROJECT_ID: 'meu-projeto-prod',
      FIRESTORE_DATABASE_ID: '(default)',
      BACKUP_BUCKET: 'gs://backup-bucket',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Banco:      (default)');
    expect(result.stdout).toContain('--database="(default)"');
    expect(result.stdout).toContain('[DRY-RUN]');
  });

  it('em dry-run inclui flag --database com named database customizado', () => {
    const result = runScript(BACKUP_SCRIPT, [], {
      FIRESTORE_PROJECT_ID: 'meu-projeto-prod',
      FIRESTORE_DATABASE_ID: 'infra-named-db-01',
      BACKUP_BUCKET: 'gs://backup-bucket',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Banco:      infra-named-db-01');
    expect(result.stdout).toContain('--database="infra-named-db-01"');
  });

  it('rejeita --apply sem ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP', () => {
    const result = runScript(BACKUP_SCRIPT, ['--apply'], {
      FIRESTORE_PROJECT_ID: 'meu-projeto-prod',
      FIRESTORE_DATABASE_ID: '(default)',
      BACKUP_BUCKET: 'gs://backup-bucket',
      ALLOW_FIRESTORE_BACKUP: undefined,
    });
    expect(result.status).toBe(1);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('ERRO DE SEGURANÇA');
  });
});

describe('G09G6R-F001 — Firestore Restore Named Database (--database flag)', () => {
  it('scripts/backup/firestoreRestore.sh existe', () => {
    expect(existsSync(RESTORE_SCRIPT)).toBe(true);
  });

  it('falha (fail-closed) quando TARGET_FIRESTORE_DATABASE_ID está ausente', () => {
    const result = runScript(RESTORE_SCRIPT, [], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: 'meu-projeto-staging',
      TARGET_FIRESTORE_DATABASE_ID: undefined,
    });
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('TARGET_FIRESTORE_DATABASE_ID');
  });

  it('falha quando TARGET_PROJECT está ausente', () => {
    const result = runScript(RESTORE_SCRIPT, [], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: undefined,
      TARGET_FIRESTORE_DATABASE_ID: '(default)',
    });
    expect(result.status).not.toBe(0);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('TARGET_PROJECT');
  });

  it('em dry-run inclui flag --database com o banco de destino (default)', () => {
    const result = runScript(RESTORE_SCRIPT, [], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: 'meu-projeto-staging',
      TARGET_FIRESTORE_DATABASE_ID: '(default)',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Banco:      (default)');
    expect(result.stdout).toContain('--database="(default)"');
    expect(result.stdout).toContain('[DRY-RUN]');
  });

  it('em dry-run inclui flag --database com named database de destino customizado', () => {
    const result = runScript(RESTORE_SCRIPT, [], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: 'meu-projeto-staging',
      TARGET_FIRESTORE_DATABASE_ID: 'staging-custom-db',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Banco:      staging-custom-db');
    expect(result.stdout).toContain('--database="staging-custom-db"');
  });

  it('bloqueia restore em produção mesmo com apply e confirmações', () => {
    const result = runScript(RESTORE_SCRIPT, ['--apply'], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: 'olhos-do-campus',
      PRODUCTION_PROJECT: 'olhos-do-campus',
      TARGET_FIRESTORE_DATABASE_ID: '(default)',
      ALLOW_RESTORE: 'CONFIRM_RESTORE_ISOLATED',
      PRE_RESTORE_BACKUP_CONFIRMED: 'YES',
    });
    expect(result.status).toBe(1);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('igual ao projeto de producao');
  });

  it('bloqueia restore se confirmação de backup pré-restore estiver ausente', () => {
    const result = runScript(RESTORE_SCRIPT, ['--apply'], {
      BACKUP_PATH: 'gs://bucket/backup-2026',
      TARGET_PROJECT: 'olhos-do-campus-staging',
      PRODUCTION_PROJECT: 'olhos-do-campus-prod',
      TARGET_FIRESTORE_DATABASE_ID: '(default)',
      ALLOW_RESTORE: 'CONFIRM_RESTORE_ISOLATED',
      PRE_RESTORE_BACKUP_CONFIRMED: 'NO',
    });
    expect(result.status).toBe(1);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain('backup pre-restore');
  });
});
