import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { FirestoreInfrastructureRepository } from '../server/repositories/infrastructureRepository';
import { FirestorePhotoMetadataRepository } from '../server/repositories/photoMetadataRepository';
import { assertPhotoStoragePath, R2PhotoRepository } from '../server/repositories/r2PhotoRepository';

function required(value: string | undefined, name: string): string { if (value === undefined || value === '') throw new Error(`${name} é obrigatório.`); return value; }
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
if (args.has('--dry-run') && apply) throw new Error('Use somente --dry-run ou --apply.');
const safetyHours = Number(process.env.RECONCILIATION_ORPHAN_SAFETY_HOURS ?? 72);
const maximum = Number(process.env.RECONCILIATION_MAX_OBJECTS ?? 50_000);
if (!Number.isInteger(safetyHours) || safetyHours < 24 || !Number.isInteger(maximum) || maximum < 1 || maximum > 100_000) throw new Error('Limites de reconciliação inválidos.');

const firebase = getFirebaseAdminServices(SERVER_ENV);
const metadataRepository = new FirestorePhotoMetadataRepository(firebase.firestore);
const objects = new R2PhotoRepository({ accountId:required(SERVER_ENV.r2AccountId,'R2_ACCOUNT_ID'),accessKeyId:required(SERVER_ENV.r2AccessKeyId,'R2_ACCESS_KEY_ID'),secretAccessKey:required(SERVER_ENV.r2SecretAccessKey,'R2_SECRET_ACCESS_KEY'),bucketName:required(SERVER_ENV.r2BucketName,'R2_BUCKET_NAME'),endpoint:required(SERVER_ENV.r2Endpoint,'R2_ENDPOINT') });
const expected = new Map<string, number>();
let metadataCursor: string | undefined;
let metadataComplete = true;
do {
  const page = await metadataRepository.listInventoryPage(metadataCursor, 500);
  for (const item of page.items) {
    if (item.photo.status !== 'READY') continue;
    expected.set(item.photo.storagePath, item.photo.byteSize);
    expected.set(item.photo.thumbnailStoragePath, item.photo.thumbnailByteSize);
    if (expected.size >= maximum && page.nextCursor !== undefined) { metadataComplete = false; break; }
  }
  metadataCursor = metadataComplete ? page.nextCursor : undefined;
} while (metadataCursor !== undefined);

const seen = new Set<string>();
const orphanCandidates: Array<{ path: string; lastModified?: Date }> = [];
const sizeMismatches: string[] = [];
let objectCursor: string | undefined;
let objectComplete = true;
do {
  const page = await objects.listPage('occurrences/', objectCursor, 500);
  for (const item of page.items) {
    seen.add(item.path);
    const size = expected.get(item.path);
    if (size === undefined) orphanCandidates.push({ path: item.path, ...(item.lastModified === undefined ? {} : { lastModified: item.lastModified }) });
    else if (item.size !== undefined && item.size !== size) sizeMismatches.push(item.path);
    if (seen.size >= maximum && page.nextCursor !== undefined) { objectComplete = false; break; }
  }
  objectCursor = objectComplete ? page.nextCursor : undefined;
} while (objectCursor !== undefined);
const missingObjects = [...expected.keys()].filter((path) => !seen.has(path));
let deletedOrphans = 0;
const cutoff = Date.now() - safetyHours * 60 * 60_000;
if (apply) {
  if (!metadataComplete || !objectComplete) throw new Error('Exclusão recusada: os inventários não foram concluídos.');
  for (const item of orphanCandidates) {
    assertPhotoStoragePath(item.path);
    if (item.lastModified === undefined || item.lastModified.getTime() > cutoff) continue;
    await objects.delete(item.path);
    deletedOrphans += 1;
  }
}
const generatedAt = new Date().toISOString();
const report = { dryRun: !apply, metadataComplete, objectComplete, inventoryComplete: metadataComplete && objectComplete, metadataCount: expected.size, objectCount: seen.size, missingObjects, orphanObjects: orphanCandidates.map((item) => item.path), sizeMismatches, deletedOrphans, safetyHours, generatedAt };
await new FirestoreInfrastructureRepository(firebase.firestore).saveReconciliationObservation({ missingObjects:missingObjects.length,orphanObjects:orphanCandidates.length,sizeMismatches:sizeMismatches.length,lastRunAt:generatedAt });
await writeFile(`storage-reconciliation-${generatedAt.slice(0,10)}.json`, `${JSON.stringify(report,null,2)}\n`, { encoding:'utf8', flag:'wx' }).catch((error:unknown) => { if ((error as {code?:string}).code !== 'EEXIST') throw error; });
console.log(JSON.stringify(report, null, 2));
