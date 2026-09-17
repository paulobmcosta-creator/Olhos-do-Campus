/**
 * G09B-F008 — R2 Inventory | Olhos do Campus 0.9.0
 * Gate: 0.9-G.6
 *
 * Lista objetos de um bucket R2/S3-compatível e produz manifesto JSON.
 * - NÃO remove objetos
 * - NÃO modifica nada
 * - Por padrão: dry-run que apenas lista
 * - Funciona com qualquer endpoint S3-compatível via variáveis de ambiente
 *
 * VARS:
 *   R2_BUCKET_NAME        — Nome do bucket (obrigatório)
 *   R2_ENDPOINT           — Endpoint S3-compatível, ex: https://<id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID      — Chave de acesso
 *   R2_SECRET_ACCESS_KEY  — Segredo
 *   R2_REGION             — Região (padrão: auto)
 *
 * USO:
 *   npx tsx scripts/backup/r2Inventory.ts
 *   npx tsx scripts/backup/r2Inventory.ts --output manifests/r2-manifest-$(date +%Y%m%d).json
 *   npx tsx scripts/backup/r2Inventory.ts --prefix fotos/2026/
 */

import {
  S3Client,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type _Object,
} from '@aws-sdk/client-s3';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface R2ObjectEntry {
  key: string;
  size: number;
  lastModified: string;
  etag: string | undefined;
  storageClass: string | undefined;
}

interface R2Manifest {
  generatedAt: string;
  bucket: string;
  endpoint: string;
  prefix: string;
  totalObjects: number;
  totalSizeBytes: number;
  objects: R2ObjectEntry[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const REGION = process.env.R2_REGION ?? 'auto';

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
const prefixIdx = args.indexOf('--prefix');
const rawPrefix = prefixIdx !== -1 ? args[prefixIdx + 1] : undefined;
const prefix: string = rawPrefix ?? '';

// ─── Validações ───────────────────────────────────────────────────────────────

function validateEnv(): void {
  const missing: string[] = [];
  if (!BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (!ENDPOINT) missing.push('R2_ENDPOINT');
  if (!ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');

  if (missing.length > 0) {
    console.error('\n[r2Inventory] ERRO: Variáveis de ambiente ausentes:');
    for (const v of missing) {
      console.error(`  - ${v}`);
    }
    console.error('\nDefina todas as variáveis antes de executar.');
    console.error('NOTA: Este script NÃO acessa R2 real nesta rodada de laboratório.');
    process.exit(1);
  }
}

// ─── Listagem de objetos ──────────────────────────────────────────────────────

async function listAllObjects(
  client: S3Client,
  bucket: string,
  keyPrefix: string,
): Promise<R2ObjectEntry[]> {
  const objects: R2ObjectEntry[] = [];
  let continuationToken: string | undefined;
  let page = 0;

  do {
    page++;
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: keyPrefix || undefined,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response: ListObjectsV2CommandOutput = await client.send(cmd);

    const contents: _Object[] = response.Contents ?? [];
    for (const obj of contents) {
      objects.push({
        key: obj.Key ?? '',
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? '',
        etag: obj.ETag?.replace(/"/g, ''),
        storageClass: obj.StorageClass,
      });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    console.log(`  Página ${page}: ${contents.length} objetos listados (total até agora: ${objects.length})`);
  } while (continuationToken);

  return objects;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n========================================================');
  console.log('  G09B-F008 — R2 Inventory | Olhos do Campus');
  console.log('========================================================\n');

  validateEnv();

  const client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
  });

  console.log(`  Bucket:   ${BUCKET_NAME}`);
  console.log(`  Endpoint: ${ENDPOINT}`);
  console.log(`  Prefix:   ${prefix || '(todos os objetos)'}`);
  console.log(`  Output:   ${outputPath ?? '(stdout apenas)'}`);
  console.log('\nIniciando listagem...\n');

  const objects = await listAllObjects(client, BUCKET_NAME!, prefix);

  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);

  const manifest: R2Manifest = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET_NAME!,
    endpoint: ENDPOINT!,
    prefix,
    totalObjects: objects.length,
    totalSizeBytes: totalSize,
    objects,
  };

  console.log('\n--- Resumo ---');
  console.log(`  Total de objetos: ${objects.length}`);
  console.log(`  Tamanho total:    ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  if (outputPath) {
    const dir = dirname(outputPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\nManifesto salvo em: ${outputPath}`);
  } else {
    console.log('\nManifesto JSON (primeiros 5 objetos):');
    const preview = { ...manifest, objects: objects.slice(0, 5) };
    console.log(JSON.stringify(preview, null, 2));
    if (objects.length > 5) {
      console.log(`  ... e mais ${objects.length - 5} objetos`);
    }
    console.log('\nDica: Use --output <caminho> para salvar o manifesto completo.');
  }

  console.log('\nInventário concluído. Nenhum objeto foi modificado ou removido.\n');
}

main().catch((err: unknown) => {
  console.error('[r2Inventory] Erro:', err);
  process.exit(1);
});
