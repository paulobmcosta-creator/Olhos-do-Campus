import 'dotenv/config';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { CloudStoragePhotoRepository } from '../server/repositories/cloudStoragePhotoRepository';
import { FirestoreStorageCleanupTaskRepository } from '../server/repositories/storageCleanupTaskRepository';

const firebase = getFirebaseAdminServices(SERVER_ENV);
const objects = new CloudStoragePhotoRepository(firebase.bucket);
const tasks = new FirestoreStorageCleanupTaskRepository(firebase.firestore);
const pending = await tasks.listPending(200);
let failedTasks = 0;

for (const task of pending) {
  try {
    for (const path of task.storagePaths) await objects.delete(path);
    await tasks.markCompleted(task.id);
    console.log(`Tarefa de limpeza concluída: ${task.id}.`);
  } catch (error: unknown) {
    failedTasks += 1;
    const message = error instanceof Error ? error.message : 'Falha de Storage';
    await tasks.markFailed(task.id, message);
    console.error(`Tarefa de limpeza falhou: ${task.id}.`);
  }
}

console.log(`Limpeza concluída. Pendentes processadas: ${pending.length}; falhas: ${failedTasks}.`);
if (failedTasks > 0) process.exitCode = 1;
