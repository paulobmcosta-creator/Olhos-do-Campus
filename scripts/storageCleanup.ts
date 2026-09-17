import 'dotenv/config';
import { getFirebaseAdminServices, getFirebaseLegacyStorageBucket } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { CloudStoragePhotoRepository } from '../server/repositories/cloudStoragePhotoRepository';
import type { PhotoRepository } from '../server/repositories/photoRepository';
import { R2PhotoRepository } from '../server/repositories/r2PhotoRepository';
import { FirestoreStorageCleanupTaskRepository } from '../server/repositories/storageCleanupTaskRepository';

function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new Error(`${name} não está configurado.`);
  return value;
}

const firebase = getFirebaseAdminServices(SERVER_ENV);
const legacy = SERVER_ENV.firebaseStorageBucket === '' ? undefined : new CloudStoragePhotoRepository(getFirebaseLegacyStorageBucket(SERVER_ENV, firebase.app));
const r2: PhotoRepository | undefined = SERVER_ENV.r2AccountId === undefined ? undefined : new R2PhotoRepository({
  accountId: required(SERVER_ENV.r2AccountId, 'R2_ACCOUNT_ID'), accessKeyId: required(SERVER_ENV.r2AccessKeyId, 'R2_ACCESS_KEY_ID'),
  secretAccessKey: required(SERVER_ENV.r2SecretAccessKey, 'R2_SECRET_ACCESS_KEY'), bucketName: required(SERVER_ENV.r2BucketName, 'R2_BUCKET_NAME'),
  endpoint: required(SERVER_ENV.r2Endpoint, 'R2_ENDPOINT'),
});
const tasks = new FirestoreStorageCleanupTaskRepository(firebase.firestore);
const pending = await tasks.listPending(200);
let failedTasks = 0;

for (const task of pending) {
  try {
    const objects = task.storageProvider === 'r2' ? r2 : legacy;
    if (objects === undefined) throw new Error(`Provider ${task.storageProvider} indisponível para esta tarefa.`);
    for (const path of task.storagePaths) await objects.delete(path);
    await tasks.markCompleted(task.id);
    console.log(`Tarefa de limpeza concluída: ${task.id}.`);
  } catch (error: unknown) {
    failedTasks += 1;
    const message = error instanceof Error ? error.message : 'Falha do provider de objetos';
    await tasks.markFailed(task.id, message);
    console.error(`Tarefa de limpeza falhou: ${task.id}.`);
  }
}

console.log(`Limpeza concluída. Pendentes processadas: ${pending.length}; falhas: ${failedTasks}.`);
if (failedTasks > 0) process.exitCode = 1;
