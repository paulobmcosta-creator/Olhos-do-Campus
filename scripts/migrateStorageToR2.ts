import 'dotenv/config';
import { getFirebaseAdminServices, getFirebaseLegacyStorageBucket } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { CloudStoragePhotoRepository } from '../server/repositories/cloudStoragePhotoRepository';
import { assertPhotoStoragePath, R2PhotoRepository } from '../server/repositories/r2PhotoRepository';
import {
  compareStorageObjects,
  createStorageMigrationVerificationReport,
  migrationHasErrors,
  verificationIsComplete,
} from './storageMigrationVerification';

function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new Error(`${name} é obrigatório para a migração.`);
  return value;
}
function objectMetadata(path: string): { occurrenceId: string; photoId: string; kind: 'INITIAL' | 'RESOLUTION' } {
  assertPhotoStoragePath(path);
  const [, occurrenceId = '', directory = '', filename = ''] = path.split('/');
  return { occurrenceId, photoId: filename.replace(/\.webp$/u, ''), kind: directory.startsWith('initial') ? 'INITIAL' : 'RESOLUTION' };
}

const argumentsSet = new Set(process.argv.slice(2));
const apply = argumentsSet.has('--apply');
const verify = apply || argumentsSet.has('--verify');
const deleteSource = argumentsSet.has('--delete-source-after-verified-migration');
if (argumentsSet.has('--dry-run') && apply) throw new Error('Use somente um modo: --dry-run ou --apply.');
if (deleteSource && (!apply || process.env.CONFIRM_DELETE_VERIFIED_FIREBASE_SOURCE !== 'DELETE_VERIFIED_FIREBASE_SOURCE_OBJECTS')) {
  throw new Error('A exclusão da origem exige --apply e CONFIRM_DELETE_VERIFIED_FIREBASE_SOURCE=DELETE_VERIFIED_FIREBASE_SOURCE_OBJECTS.');
}

const firebase = getFirebaseAdminServices(SERVER_ENV);
const source = new CloudStoragePhotoRepository(getFirebaseLegacyStorageBucket(SERVER_ENV, firebase.app));
const target = new R2PhotoRepository({
  accountId: required(SERVER_ENV.r2AccountId, 'R2_ACCOUNT_ID'), accessKeyId: required(SERVER_ENV.r2AccessKeyId, 'R2_ACCESS_KEY_ID'),
  secretAccessKey: required(SERVER_ENV.r2SecretAccessKey, 'R2_SECRET_ACCESS_KEY'), bucketName: required(SERVER_ENV.r2BucketName, 'R2_BUCKET_NAME'),
  endpoint: required(SERVER_ENV.r2Endpoint, 'R2_ENDPOINT'),
});

const counters = createStorageMigrationVerificationReport();
const report = {
  mode: deleteSource ? 'delete-source-after-verified-migration' : apply ? 'apply' : verify ? 'verify' : 'dry-run',
  verify,
  ...counters,
};
let cursor: string | undefined;
do {
  const page = await source.listPage('occurrences/', cursor, 200);
  for (const item of page.items) {
    report.listed += 1;
    try {
      const metadata = objectMetadata(item.path);
      report.eligibleSourceObjects += 1;
      let destination = await target.getMetadata(item.path);

      if (!verify) {
        if (destination === undefined) report.missingDestination += 1;
        else if (item.size !== undefined && destination.size !== undefined && destination.size === item.size) report.alreadyPresent += 1;
        continue;
      }

      const sourceBytes = await source.read(item.path);
      if (sourceBytes === undefined) throw new Error('Objeto de origem desapareceu durante a verificação.');
      let targetBytes = destination === undefined ? undefined : await target.read(item.path);
      let comparison = compareStorageObjects(sourceBytes, targetBytes);

      if (comparison === 'VERIFIED') {
        report.alreadyPresent += 1;
        report.verified += 1;
        continue;
      }

      if (apply && !deleteSource) {
        await target.save(item.path, sourceBytes, metadata);
        report.copied += 1;
        destination = await target.getMetadata(item.path);
        targetBytes = destination === undefined ? undefined : await target.read(item.path);
        comparison = compareStorageObjects(sourceBytes, targetBytes);
      }

      if (comparison === 'VERIFIED') report.verified += 1;
      else if (comparison === 'MISSING_DESTINATION') report.missingDestination += 1;
      else report.mismatches += 1;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PHOTO_STORAGE_PATH_INVALID') report.rejectedPaths += 1;
      else report.failures += 1;
      console.error(`Falha segura no item ${report.listed}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }
  cursor = page.nextCursor;
} while (cursor !== undefined);

if (deleteSource) {
  if (report.eligibleSourceObjects === 0 || !verificationIsComplete(report)) {
    console.error('Exclusão da origem recusada: a verificação integral do inventário elegível não foi aprovada. Nenhum objeto foi removido nesta execução.');
    process.exitCode = 1;
  } else {
    let deleteCursor: string | undefined;
    do {
      const page = await source.listPage('occurrences/', deleteCursor, 200);
      for (const item of page.items) {
        objectMetadata(item.path);
        const [sourceBytes, targetBytes] = await Promise.all([source.read(item.path), target.read(item.path)]);
        if (compareStorageObjects(sourceBytes, targetBytes) !== 'VERIFIED') {
          throw new Error(`Exclusão interrompida: o objeto ${item.path} mudou após a verificação completa.`);
        }
        await source.delete(item.path);
        report.deletedSource += 1;
      }
      deleteCursor = page.nextCursor;
    } while (deleteCursor !== undefined);
  }
}

console.log(JSON.stringify(report, null, 2));
if (migrationHasErrors(report, verify)) {
  if (verify && report.verified !== report.eligibleSourceObjects) {
    console.error(`Verificação incompleta: ${report.verified}/${report.eligibleSourceObjects} objetos elegíveis foram verificados integralmente.`);
  }
  process.exitCode = 1;
}
