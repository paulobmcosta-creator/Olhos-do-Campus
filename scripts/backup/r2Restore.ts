/**
 * G09B-F008 — R2 Restore (Cópia entre Buckets) | Olhos do Campus 0.9.0
 * Gate: 0.9-G.6
 *
 * Copia objetos de um bucket S3-compatível para outro.
 * - NUNCA remove objetos por padrão
 * - DRY-RUN é padrão SEMPRE
 * - Requer ALLOW_R2_COPY=CONFIRM_R2_COPY para executar
 * - Funciona com qualquer endpoint S3-compatível
 *
 * USO:
 *   # Dry-run:
 *   npx tsx scripts/backup/r2Restore.ts \
 *     --source-bucket backup-bucket \
 *     --target-bucket staging-bucket \
 *     --target-prefix restore-20260914/
 *
 *   # Execução real:
 *   ALLOW_R2_COPY=CONFIRM_R2_COPY \
 *   npx tsx scripts/backup/r2Restore.ts \
 *     --source-bucket backup-bucket \
 *     --target-bucket staging-bucket \
 *     --target-prefix restore-20260914/ \
 *     --apply
 *
 * VARS:
 *   R2_ENDPOINT           — Endpoint S3-compatível (obrigatório)
 *   R2_ACCESS_KEY_ID      — Chave de acesso (obrigatório)
 *   R2_SECRET_ACCESS_KEY  — Segredo (obrigatório)
 *   ALLOW_R2_COPY         — Deve ser "CONFIRM_R2_COPY" para --apply
 *   R2_REGION             — Região (padrão: auto)
 */

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  type _Object,
} from '@aws-sdk/client-s3';

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const sourceBucket = getArg('--source-bucket');
const targetBucket = getArg('--target-bucket');
const targetPrefix = getArg('--target-prefix') ?? '';
const sourcePrefix = getArg('--source-prefix') ?? '';
const dryRun = !args.includes('--apply');

// ─── Config ───────────────────────────────────────────────────────────────────

const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const REGION = process.env.R2_REGION ?? 'auto';
const ALLOW_R2_COPY = process.env.ALLOW_R2_COPY;

// ─── Validações ───────────────────────────────────────────────────────────────

function validateArgs(): void {
  const errors: string[] = [];

  if (!sourceBucket) errors.push('--source-bucket <nome> obrigatório');
  if (!targetBucket) errors.push('--target-bucket <nome> obrigatório');
  if (!ENDPOINT) errors.push('Variável R2_ENDPOINT não definida');
  if (!ACCESS_KEY_ID) errors.push('Variável R2_ACCESS_KEY_ID não definida');
  if (!SECRET_ACCESS_KEY) errors.push('Variável R2_SECRET_ACCESS_KEY não definida');

  if (errors.length > 0) {
    console.error('\n[r2Restore] ERRO de configuração:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  if (!dryRun) {
    if (ALLOW_R2_COPY !== 'CONFIRM_R2_COPY') {
      console.error('\n[r2Restore] ERRO DE SEGURANÇA:');
      console.error('  Para executar cópia real, defina: ALLOW_R2_COPY=CONFIRM_R2_COPY');
      console.error('\nExemplo:');
      console.error(
        '  ALLOW_R2_COPY=CONFIRM_R2_COPY npx tsx scripts/backup/r2Restore.ts --source-bucket <src> --target-bucket <dst> --apply',
      );
      process.exit(1);
    }

    if (sourceBucket === targetBucket && targetPrefix === '') {
      console.error('\n[r2Restore] ERRO: source-bucket e target-bucket são iguais sem target-prefix.');
      console.error('  Use --target-prefix para evitar sobrescrever objetos existentes.');
      process.exit(1);
    }
  }
}

// ─── Listagem ─────────────────────────────────────────────────────────────────

async function listObjects(client: S3Client, bucket: string, prefix: string): Promise<_Object[]> {
  const objects: _Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    objects.push(...(response.Contents ?? []));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

// ─── Cópia ────────────────────────────────────────────────────────────────────

async function copyObject(
  client: S3Client,
  srcBucket: string,
  srcKey: string,
  dstBucket: string,
  dstKey: string,
): Promise<void> {
  await client.send(
    new CopyObjectCommand({
      CopySource: `${srcBucket}/${srcKey}`,
      Bucket: dstBucket,
      Key: dstKey,
    }),
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n========================================================');
  console.log('  G09B-F008 — R2 Restore (Cópia) | Olhos do Campus');
  console.log('========================================================\n');

  validateArgs();

  if (!dryRun) {
    console.log('AVISO: MODO REAL ATIVADO — Objetos serão copiados\n');
  }

  console.log(`  Source Bucket:  ${sourceBucket}`);
  console.log(`  Source Prefix:  ${sourcePrefix || '(todos)'}`);
  console.log(`  Target Bucket:  ${targetBucket}`);
  console.log(`  Target Prefix:  ${targetPrefix || '(raiz)'}`);
  console.log(`  DRY-RUN:        ${dryRun}`);
  console.log('');

  const client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
  });

  console.log('Listando objetos no bucket de origem...');
  const objects = await listObjects(client, sourceBucket!, sourcePrefix);
  console.log(`  ${objects.length} objetos encontrados.\n`);

  if (objects.length === 0) {
    console.log('Nenhum objeto para copiar. Encerrando.\n');
    return;
  }

  let copied = 0;
  let errors = 0;

  for (const obj of objects) {
    const srcKey = obj.Key ?? '';
    const relKey = sourcePrefix ? srcKey.replace(sourcePrefix, '') : srcKey;
    const dstKey = `${targetPrefix}${relKey}`;

    if (dryRun) {
      console.log(`[DRY-RUN] Copiaria: ${srcKey} → ${targetBucket}/${dstKey}`);
    } else {
      try {
        await copyObject(client, sourceBucket!, srcKey, targetBucket!, dstKey);
        console.log(`[OK] ${srcKey} → ${dstKey}`);
        copied++;
      } catch (err: unknown) {
        console.error(`[ERRO] ${srcKey}: ${String(err)}`);
        errors++;
      }
    }
  }

  console.log('\n--- Resumo ---');
  if (dryRun) {
    console.log(`  [DRY-RUN] ${objects.length} objetos seriam copiados.`);
    console.log('\n  Para executar:');
    console.log(
      `  ALLOW_R2_COPY=CONFIRM_R2_COPY npx tsx scripts/backup/r2Restore.ts \\`,
    );
    console.log(`    --source-bucket ${sourceBucket} --target-bucket ${targetBucket} --apply`);
  } else {
    console.log(`  Copiados com sucesso: ${copied}`);
    console.log(`  Erros:               ${errors}`);
    if (errors > 0) {
      console.error('\nATENÇÃO: Houve erros durante a cópia. Verifique os logs acima.');
      process.exit(1);
    }
  }

  console.log('\nNenhum objeto foi removido.\n');
}

main().catch((err: unknown) => {
  console.error('[r2Restore] Erro fatal:', err);
  process.exit(1);
});
