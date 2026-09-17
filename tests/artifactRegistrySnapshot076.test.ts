import { describe, expect, it } from 'vitest';
import { parseArtifactRegistryRecords } from '../server/utils/artifactRegistryParser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Artifact Registry Parser (0.7.6)', () => {
  it('calcula corretamente o total de bytes e contagem para registros válidos com imageSizeBytes numérico', () => {
    const records = [
      { IMAGE: 'app', DIGEST: 'sha256:111', imageSizeBytes: 100_000_000 },
      { IMAGE: 'app', DIGEST: 'sha256:222', imageSizeBytes: 150_000_000 },
    ];

    const result = parseArtifactRegistryRecords(records, 'olhos-do-campus');
    expect(result.totalBytes).toBe(250_000_000);
    expect(result.versionCount).toBe(2);
    expect(result.repository).toBe('olhos-do-campus');
  });

  it('suporta campos alternativos como IMAGE_SIZE_BYTES e sizeBytes e converte strings numéricas', () => {
    const records = [
      { IMAGE: 'app', DIGEST: 'sha256:111', IMAGE_SIZE_BYTES: '100000' },
      { IMAGE: 'app', DIGEST: 'sha256:222', sizeBytes: 200000 },
    ];

    const result = parseArtifactRegistryRecords(records);
    expect(result.totalBytes).toBe(300000);
    expect(result.versionCount).toBe(2);
  });

  it('retorna 0 bytes e 0 versões para lista vazia sem lançar erro', () => {
    const result = parseArtifactRegistryRecords([]);
    expect(result.totalBytes).toBe(0);
    expect(result.versionCount).toBe(0);
  });

  it('rejeita e falha rápido quando existem imagens listadas mas nenhuma métrica de tamanho válida (evita persistir bytes = 0)', () => {
    const recordsWithoutSize = [
      { IMAGE: 'app', DIGEST: 'sha256:111', TAGS: ['latest'] },
      { IMAGE: 'app', DIGEST: 'sha256:222', TAGS: ['v0.7.5'] },
    ];

    expect(() => parseArtifactRegistryRecords(recordsWithoutSize)).toThrow(/ARTIFACT_REGISTRY_PARSER_ERROR.*tamanho/u);
  });

  it('rejeita quando apenas parte dos registros possui tamanho numérico válido', () => {
    const partialRecords = [
      { IMAGE: 'app', DIGEST: 'sha256:111', imageSizeBytes: 100_000 },
      { IMAGE: 'app', DIGEST: 'sha256:222' }, // tamanho ausente
    ];

    expect(() => parseArtifactRegistryRecords(partialRecords)).toThrow(/ARTIFACT_REGISTRY_PARSER_ERROR.*Apenas 1 de 2/u);
  });

  it('valida estaticamente que o script artifactRegistrySnapshot.ts não importa SERVER_ENV', () => {
    const scriptPath = resolve(__dirname, '../scripts/artifactRegistrySnapshot.ts');
    const content = readFileSync(scriptPath, 'utf8');
    expect(content).not.toContain('SERVER_ENV');
    expect(content).toContain('parseArtifactRegistryRecords');
    expect(content).toContain('getFirebaseAdminServices');
  });
});
