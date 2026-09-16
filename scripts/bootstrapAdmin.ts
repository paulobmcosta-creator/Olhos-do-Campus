import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreForDatabase } from '../server/config/firebaseAdmin';
import { loadFirebaseAppletRuntimeConfig, resolveFirebaseRuntime } from '../server/config/firebaseRuntime';
import { emailDomain, hashNormalizedEmail, validateEmail } from '../server/utils/email';

interface Arguments {
  email: string;
  displayName?: string;
  dryRun: boolean;
  force: boolean;
  emulator: boolean;
}

function readArguments(argv: string[]): Arguments {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const argument of argv) {
    if (!argument.startsWith('--')) continue;
    const separator = argument.indexOf('=');
    if (separator === -1) flags.add(argument.slice(2));
    else values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  const email = values.get('email')?.trim() ?? '';
  if (email === '') {
    throw new Error('Informe --email=usuario@dominio.institucional.');
  }
  return {
    email,
    ...(values.get('display-name')?.trim() ? { displayName: values.get('display-name')?.trim() } : {}),
    dryRun: flags.has('dry-run'),
    force: flags.has('force'),
    emulator: flags.has('emulator'),
  };
}

function allowedDomains(): Set<string> {
  const domains = (process.env.ALLOWED_ADMIN_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) throw new Error('ALLOWED_ADMIN_DOMAINS deve conter ao menos um domínio autorizado.');
  return new Set(domains);
}

async function main(): Promise<void> {
  const args = readArguments(process.argv.slice(2));
  if (args.emulator) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }

  const emulatorMode = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const appletConfig = loadFirebaseAppletRuntimeConfig();
  const firebaseRuntime = resolveFirebaseRuntime({
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
    emulatorMode,
    ...(appletConfig === undefined ? {} : { appletConfig }),
  });
  const projectId = firebaseRuntime.projectId;

  const normalizedEmail = validateEmail(args.email);
  if (!allowedDomains().has(emailDomain(normalizedEmail))) {
    throw new Error('O e-mail não pertence a um domínio autorizado em ALLOWED_ADMIN_DOMAINS.');
  }

  const id = hashNormalizedEmail(normalizedEmail);
  const displayName = args.displayName ?? normalizedEmail;
  const appName = 'olhos-do-campus-bootstrap-admin';
  const existingApp = getApps().find((app) => app.name === appName);
  const app = existingApp ?? initializeApp(
    emulatorMode ? { projectId } : { projectId, credential: applicationDefault() },
    appName,
  );
  const firestore = getFirestoreForDatabase(app, firebaseRuntime.firestoreDatabaseId);
  const adminDocument = firestore.collection('adminUsers').doc(id);
  const snapshot = await adminDocument.get();

  console.log(`Projeto: ${projectId}`);
  console.log(`Banco Firestore: ${firebaseRuntime.firestoreDatabaseId}`);
  console.log(`Destino: adminUsers/${id}`);
  console.log(`E-mail normalizado: ${normalizedEmail}`);
  console.log(`Ambiente: ${emulatorMode ? 'Firestore Emulator' : 'Firebase em nuvem com Application Default Credentials'}`);

  if (snapshot.exists && !args.force) {
    throw new Error('O cadastro já existe. Revise-o e repita com --force somente se a sobrescrita for intencional.');
  }
  if (args.dryRun) {
    console.log(snapshot.exists ? 'Dry-run: o cadastro existente seria promovido a Administrador ativo.' : 'Dry-run: um novo Administrador ativo seria criado.');
    return;
  }

  const actorId = 'bootstrap-admin-script';
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(adminDocument);
    if (current.exists && !args.force) {
      throw new Error('O cadastro passou a existir durante a operação; nenhuma alteração foi aplicada.');
    }
    const data = {
      email: normalizedEmail,
      normalizedEmail,
      displayName,
      role: 'Administrador',
      active: true,
      ...(current.exists ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: actorId }),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorId,
    };
    transaction.set(adminDocument, data, { merge: true });
    const auditDocument = firestore.collection('auditLogs').doc();
    transaction.create(auditDocument, {
      eventType: current.exists ? 'ADMIN_USER_UPDATED' : 'ADMIN_USER_CREATED',
      actorRole: 'Administrador',
      targetType: 'adminUser',
      targetId: id,
      timestamp: FieldValue.serverTimestamp(),
      summary: current.exists
        ? 'Cadastro promovido a Administrador ativo pelo script seguro de bootstrap.'
        : 'Primeiro Administrador criado pelo script seguro de bootstrap.',
    });
  });

  console.log('Operação concluída sem impressão de tokens ou credenciais.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida no bootstrap administrativo.');
  process.exitCode = 1;
});
