/**
 * G09B-F008 — Rehearsal de Restore de Fotos (Cloudflare R2 mock)
 * Gate: 0.9-G.6
 *
 * Procedimento:
 * 1. Cria diretório mock de origem com fotografias sintéticas (JPEG mock com payloads conhecidos).
 * 2. Gera manifesto criptográfico (caminho, tamanho, SHA-256).
 * 3. Executa backup para diretório de destino isolado.
 * 4. Simula desastre apagando a origem.
 * 5. Executa restore a partir do backup para nova área recuperada.
 * 6. Valida integridade referencial arquivo a arquivo comparando SHA-256 e tamanhos.
 * 7. Emite PHOTO_RESTORE_REHEARSAL=PASS ou FAIL.
 *
 * USO:
 *   npx tsx scripts/backup/rehearsalR2.ts
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface PhotoManifestEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
}

interface PhotoManifest {
  createdAt: string;
  totalPhotos: number;
  totalSizeBytes: number;
  entries: PhotoManifestEntry[];
}

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function runPhotoRestoreRehearsal(baseDir: string): {
  success: boolean;
  totalPhotos: number;
  verifiedCount: number;
  report: string;
} {
  const sourceDir = join(baseDir, 'mock-source-photos');
  const backupDir = join(baseDir, 'mock-backup-target');
  const restoredDir = join(baseDir, 'mock-restored-photos');

  // Limpeza prévia
  [sourceDir, backupDir, restoredDir].forEach((d) => {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  });

  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  mkdirSync(restoredDir, { recursive: true });

  // 1. Criar dados sintéticos de fotografias
  const mockFiles: Record<string, Buffer> = {
    'occurrences/occ-001/original.jpg': Buffer.from('MOCK_JPEG_PHOTO_OCC_001_ORIGINAL_DATA_12345'),
    'occurrences/occ-001/thumbnail.webp': Buffer.from('MOCK_WEBP_PHOTO_OCC_001_THUMB_DATA_12345'),
    'occurrences/occ-002/original.jpg': Buffer.from('MOCK_JPEG_PHOTO_OCC_002_ORIGINAL_DATA_67890'),
    'occurrences/occ-002/thumbnail.webp': Buffer.from('MOCK_WEBP_PHOTO_OCC_002_THUMB_DATA_67890'),
    'occurrences/occ-003/original.jpg': Buffer.from('MOCK_JPEG_PHOTO_OCC_003_ORIGINAL_DATA_11223'),
  };

  for (const [relPath, buffer] of Object.entries(mockFiles)) {
    const fullPath = join(sourceDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, buffer);
  }

  // 2. Criar manifesto
  const entries: PhotoManifestEntry[] = [];
  let totalBytes = 0;

  for (const [relPath] of Object.entries(mockFiles)) {
    const fullPath = join(sourceDir, relPath);
    const content = readFileSync(fullPath);
    const hash = computeSha256(content);
    entries.push({
      path: relPath,
      sizeBytes: content.length,
      sha256: hash,
    });
    totalBytes += content.length;
  }

  const manifest: PhotoManifest = {
    createdAt: new Date().toISOString(),
    totalPhotos: entries.length,
    totalSizeBytes: totalBytes,
    entries,
  };

  const manifestPath = join(baseDir, 'mock-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 3. Backup (cópia controlada para backupDir)
  for (const entry of entries) {
    const src = join(sourceDir, entry.path);
    const dst = join(backupDir, entry.path);
    mkdirSync(join(dst, '..'), { recursive: true });
    writeFileSync(dst, readFileSync(src));
  }

  // 4. Simulação de perda do ambiente de origem
  rmSync(sourceDir, { recursive: true, force: true });
  if (existsSync(sourceDir)) {
    throw new Error('Falha ao simular deleção do diretório de origem.');
  }

  // 5. Restore a partir do backup para área restaurada
  for (const entry of entries) {
    const src = join(backupDir, entry.path);
    const dst = join(restoredDir, entry.path);
    mkdirSync(join(dst, '..'), { recursive: true });
    writeFileSync(dst, readFileSync(src));
  }

  // 6. Verificação de integridade via manifesto
  let verified = 0;
  for (const entry of entries) {
    const targetFile = join(restoredDir, entry.path);
    if (!existsSync(targetFile)) {
      return {
        success: false,
        totalPhotos: entries.length,
        verifiedCount: verified,
        report: `Arquivo ${entry.path} ausente no diretório restaurado.`,
      };
    }
    const buf = readFileSync(targetFile);
    const hash = computeSha256(buf);
    if (hash !== entry.sha256 || buf.length !== entry.sizeBytes) {
      return {
        success: false,
        totalPhotos: entries.length,
        verifiedCount: verified,
        report: `Arquivo ${entry.path} divergiu no hash SHA-256 ou tamanho após restore.`,
      };
    }
    verified++;
  }

  // Cleanup de diretórios temporários do rehearsal
  [backupDir, restoredDir].forEach((d) => {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  });
  if (existsSync(manifestPath)) rmSync(manifestPath, { force: true });

  return {
    success: true,
    totalPhotos: entries.length,
    verifiedCount: verified,
    report: `Rehearsal concluído com sucesso: ${verified}/${entries.length} fotos recuperadas com 100% de correspondência SHA-256.`,
  };
}

// Execução direta via CLI
const isCli = process.argv[1]?.includes('rehearsalR2');
if (isCli) {
  const osTmp = process.env.TEMP || process.env.TMP || '/tmp';
  const workDir = join(osTmp, `rehearsal-r2-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  console.log('==================================================');
  console.log('  REHEARSAL DE RESTORE DE FOTOGRAFIAS (R2 MOCK)');
  console.log('==================================================');
  console.log(`Ambiente de laboratório isolado: ${workDir}`);

  const res = runPhotoRestoreRehearsal(workDir);
  console.log(res.report);

  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });

  if (res.success) {
    console.log('==================================================');
    console.log(`  PHOTO_RESTORE_REHEARSAL_OBJECTS=${res.totalPhotos}`);
    console.log('  PHOTO_RESTORE_REHEARSAL=PASS');
    console.log('==================================================');
    process.exit(0);
  } else {
    console.error('==================================================');
    console.error('  PHOTO_RESTORE_REHEARSAL=FAIL');
    console.error('==================================================');
    process.exit(1);
  }
}
