import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { resolveFirebaseRuntime } from '../server/config/firebaseRuntime';
import { parseArtifactRegistryRecords } from '../server/utils/artifactRegistryParser';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`${name} é obrigatório.`);
  }
  return value;
}

async function main(): Promise<void> {
  const project = required('ARTIFACT_REGISTRY_PROJECT_ID');
  const location = required('ARTIFACT_REGISTRY_LOCATION');
  const repository = required('ARTIFACT_REGISTRY_REPOSITORY');
  const image = process.env.ARTIFACT_REGISTRY_IMAGE?.trim();
  const target = image === undefined || image === ''
    ? `${location}-docker.pkg.dev/${project}/${repository}`
    : `${location}-docker.pkg.dev/${project}/${repository}/${image}`;

  const result = spawnSync(
    'gcloud',
    ['artifacts', 'docker', 'images', 'list', target, '--include-tags', '--format=json', `--project=${project}`],
    { encoding: 'utf8', shell: false },
  );

  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`gcloud não conseguiu listar o Artifact Registry: ${result.stderr}`);

  const parsed = JSON.parse(result.stdout) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Resposta inesperada do gcloud.');

  const { totalBytes, versionCount } = parseArtifactRegistryRecords(parsed, repository);

  // Inicializar Firebase Admin SDK com configuração desacoplada do ambiente do servidor
  const runtime = resolveFirebaseRuntime({
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
    emulatorMode: false,
    requireStorageBucket: false,
  });

  const firebase = getFirebaseAdminServices({
    emulatorMode: false,
    firebaseProjectId: runtime.projectId,
    firestoreDatabaseId: runtime.firestoreDatabaseId,
  });

  const capturedAt = new Date();
  const snapshotId = `snapshot-${capturedAt.toISOString().replaceAll(':', '-')}`;

  await firebase.firestore.collection('artifactRegistrySnapshots').doc(snapshotId).create({
    schemaVersion: 1,
    capturedAt: Timestamp.fromDate(capturedAt),
    bytes: totalBytes,
    versionCount,
    repository,
  });

  console.log(JSON.stringify({
    snapshotId,
    capturedAt: capturedAt.toISOString(),
    bytes: totalBytes,
    versionCount,
    repository,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error('Erro ao executar snapshot do Artifact Registry:', error);
  process.exit(1);
});
