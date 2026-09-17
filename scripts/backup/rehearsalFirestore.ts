/**
 * G09B-F008 — Rehearsal de Restore Firestore | Olhos do Campus 0.9.0
 * Gate: 0.9-G.6
 *
 * Demonstra o procedimento de backup/restore usando Firestore Emulator.
 * NUNCA conecta a produção.
 *
 * Passos:
 *  1. Verifica que está em modo emulator (FIRESTORE_EMULATOR_HOST obrigatório)
 *  2. Cria documentos sintéticos de teste
 *  3. Lê e serializa como "snapshot" JSON (simula export)
 *  4. Deleta os documentos
 *  5. Recria a partir do snapshot (simula import)
 *  6. Verifica integridade
 *  7. Reporta FIRESTORE_RESTORE_REHEARSAL=PASS ou FAIL
 *
 * USO:
 *   firebase emulators:start --only firestore &
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GCLOUD_PROJECT=olhos-do-campus-local \
 *   npx tsx scripts/backup/rehearsalFirestore.ts
 */

import { initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SyntheticOccurrence {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  rehearsalTag: string;
}

type DocumentData = Record<string, unknown>;

interface Snapshot {
  collection: string;
  generatedAt: string;
  documents: Array<{ id: string; data: DocumentData }>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const REHEARSAL_COLLECTION = 'rehearsal_backup_test';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'olhos-do-campus-local';

const SYNTHETIC_DOCS: SyntheticOccurrence[] = [
  {
    id: 'rehearsal-doc-001',
    title: 'Ocorrência Sintética 1 — Teste de Backup',
    status: 'aberta',
    createdAt: new Date().toISOString(),
    rehearsalTag: 'G09B-F008-REHEARSAL',
  },
  {
    id: 'rehearsal-doc-002',
    title: 'Ocorrência Sintética 2 — Teste de Backup',
    status: 'em_andamento',
    createdAt: new Date().toISOString(),
    rehearsalTag: 'G09B-F008-REHEARSAL',
  },
  {
    id: 'rehearsal-doc-003',
    title: 'Ocorrência Sintética 3 — Teste de Backup',
    status: 'resolvida',
    createdAt: new Date().toISOString(),
    rehearsalTag: 'G09B-F008-REHEARSAL',
  },
];

// ─── Utilitários ─────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`  ${msg}`);
}

function pass(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): void {
  console.error(`  ✗ ${msg}`);
}

// ─── Verificação de emulator ──────────────────────────────────────────────────

function assertEmulatorMode(): void {
  if (!EMULATOR_HOST) {
    console.error('\n[rehearsalFirestore] ERRO CRÍTICO DE SEGURANÇA:');
    console.error('  FIRESTORE_EMULATOR_HOST não está definido.');
    console.error('  Este script NUNCA deve conectar ao Firestore de produção.');
    console.error('');
    console.error('  Para executar:');
    console.error('    1. Inicie o emulator: npm run emulators');
    console.error('    2. Execute com:');
    console.error('       FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/backup/rehearsalFirestore.ts');
    console.error('');
    console.error('FIRESTORE_RESTORE_REHEARSAL=EMULATOR_REQUIRED');
    process.exit(2);
  }

  log(`Emulator detectado: ${EMULATOR_HOST}`);
  log(`Project ID: ${PROJECT_ID}`);
}

// ─── Operações Firestore ──────────────────────────────────────────────────────

async function createSyntheticDocuments(db: Firestore): Promise<void> {
  const batch = db.batch();
  for (const doc of SYNTHETIC_DOCS) {
    const ref = db.collection(REHEARSAL_COLLECTION).doc(doc.id);
    batch.set(ref, doc);
  }
  await batch.commit();
  pass(`${SYNTHETIC_DOCS.length} documentos sintéticos criados em '${REHEARSAL_COLLECTION}'`);
}

async function readSnapshot(db: Firestore): Promise<Snapshot> {
  const snap = await db.collection(REHEARSAL_COLLECTION).get();
  const documents: Array<{ id: string; data: DocumentData }> = snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as DocumentData,
  }));
  const snapshot: Snapshot = {
    collection: REHEARSAL_COLLECTION,
    generatedAt: new Date().toISOString(),
    documents,
  };
  pass(`Snapshot capturado: ${documents.length} documentos`);
  return snapshot;
}

async function deleteDocuments(db: Firestore): Promise<void> {
  const snap = await db.collection(REHEARSAL_COLLECTION).get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  pass(`${snap.docs.length} documentos deletados (simulando wipe pré-restore)`);
}

async function verifyEmpty(db: Firestore): Promise<void> {
  const snap = await db.collection(REHEARSAL_COLLECTION).get();
  if (snap.docs.length !== 0) {
    throw new Error(`Esperava 0 documentos após delete, encontrou ${snap.docs.length}`);
  }
  pass('Verificação pós-delete: coleção está vazia');
}

async function restoreFromSnapshot(db: Firestore, snapshot: Snapshot): Promise<void> {
  const batch = db.batch();
  for (const entry of snapshot.documents) {
    const ref = db.collection(snapshot.collection).doc(entry.id);
    batch.set(ref, entry.data);
  }
  await batch.commit();
  pass(`${snapshot.documents.length} documentos restaurados do snapshot`);
}

async function verifyRestore(db: Firestore, snapshot: Snapshot): Promise<void> {
  const snap = await db.collection(REHEARSAL_COLLECTION).get();
  const restored = snap.docs.map((d) => d.id).sort();
  const expected = snapshot.documents.map((d) => d.id).sort();

  if (restored.length !== expected.length) {
    throw new Error(
      `Contagem de documentos difere: esperado=${expected.length}, restaurado=${restored.length}`,
    );
  }

  for (let i = 0; i < expected.length; i++) {
    if (restored[i] !== expected[i]) {
      throw new Error(`ID diverge: esperado='${expected[i]}', encontrado='${restored[i]}'`);
    }
  }

  // Verificar campos chave
  for (const originalDoc of snapshot.documents) {
    const restoredDoc = snap.docs.find((d) => d.id === originalDoc.id);
    if (!restoredDoc) {
      throw new Error(`Documento '${originalDoc.id}' não encontrado após restore`);
    }
    const data = restoredDoc.data();
    const originalData = originalDoc.data as Record<string, unknown>;
    if (data['title'] !== originalData['title']) {
      throw new Error(
        `Campo 'title' diverge para '${originalDoc.id}': esperado='${String(originalData['title'])}', encontrado='${String(data['title'])}'`,
      );
    }
    if (data['rehearsalTag'] !== 'G09B-F008-REHEARSAL') {
      throw new Error(`Campo 'rehearsalTag' ausente ou incorreto em '${originalDoc.id}'`);
    }
  }

  pass(`Integridade verificada: todos os ${restored.length} documentos conferem`);
}

async function cleanup(db: Firestore): Promise<void> {
  const snap = await db.collection(REHEARSAL_COLLECTION).get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  log(`Limpeza: ${snap.docs.length} documentos de rehearsal removidos`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n========================================================');
  console.log('  G09B-F008 — Rehearsal Firestore | Olhos do Campus');
  console.log('========================================================\n');

  // PASSO 0: Verificar emulator
  assertEmulatorMode();
  console.log('');

  // Inicializar Firebase Admin (sem credenciais — emulator não requer)
  let app: App;
  try {
    app = initializeApp({ projectId: PROJECT_ID }, 'rehearsal-firestore');
  } catch {
    app = initializeApp({ projectId: PROJECT_ID });
  }

  const db = getFirestore(app);

  let rehearsalResult: 'PASS' | 'FAIL' = 'FAIL';
  const stepResults: Record<string, 'OK' | 'FAIL'> = {};

  try {
    // PASSO 1: Criar documentos sintéticos
    console.log('[Passo 1] Criando documentos sintéticos de teste...');
    await createSyntheticDocuments(db);
    stepResults['create'] = 'OK';
    console.log('');

    // PASSO 2: Capturar snapshot (simula export)
    console.log('[Passo 2] Capturando snapshot (simula backup export)...');
    const snapshot = await readSnapshot(db);
    stepResults['snapshot'] = 'OK';
    console.log('');

    // PASSO 3: Deletar documentos (simula wipe pré-restore)
    console.log('[Passo 3] Deletando documentos (simula wipe pré-restore)...');
    await deleteDocuments(db);
    await verifyEmpty(db);
    stepResults['delete'] = 'OK';
    console.log('');

    // PASSO 4: Restaurar do snapshot (simula import)
    console.log('[Passo 4] Restaurando do snapshot (simula restore import)...');
    await restoreFromSnapshot(db, snapshot);
    stepResults['restore'] = 'OK';
    console.log('');

    // PASSO 5: Verificar integridade
    console.log('[Passo 5] Verificando integridade pós-restore...');
    await verifyRestore(db, snapshot);
    stepResults['verify'] = 'OK';
    console.log('');

    rehearsalResult = 'PASS';
  } catch (err: unknown) {
    fail(`Erro no rehearsal: ${String(err)}`);
    stepResults['error'] = 'FAIL';
    rehearsalResult = 'FAIL';
  } finally {
    // Limpeza sempre, independente do resultado
    console.log('[Limpeza] Removendo documentos de rehearsal...');
    try {
      await cleanup(db);
    } catch (cleanErr: unknown) {
      console.warn(`  Aviso: falha na limpeza: ${String(cleanErr)}`);
    }
    console.log('');
  }

  // ─── Relatório Final ───────────────────────────────────────────────────────
  console.log('======================================================');
  console.log('  Resultado do Rehearsal Firestore');
  console.log('======================================================');
  for (const [step, result] of Object.entries(stepResults)) {
    console.log(`  ${step.padEnd(12)}: ${result}`);
  }
  console.log('');
  console.log(`FIRESTORE_RESTORE_REHEARSAL=${rehearsalResult}`);
  console.log('');

  if (rehearsalResult === 'FAIL') {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('[rehearsalFirestore] Erro fatal:', err);
  console.error('\nFIRESTORE_RESTORE_REHEARSAL=FAIL');
  process.exit(1);
});
