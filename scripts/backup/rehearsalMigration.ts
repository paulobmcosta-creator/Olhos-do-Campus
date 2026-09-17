/**
 * G09B-F014 — Rehearsal de Recuperação de Migração (Preimage / Restore)
 * Gate: 0.9-G.6
 *
 * Procedimento comprovável:
 * 1. Conecta exclusivamente ao Firestore Emulator.
 * 2. Popula estado pré-migração sintético em `operationalTeams` e `adminUsers`.
 * 3. Gera manifesto / preimage do estado inicial (backup pré-migração).
 * 4. Aplica migração 0.8.0 de laboratório via batch writes.
 * 5. Valida que o estado sofreu mutação esperada da migração.
 * 6. Executa recuperação a partir do preimage (reversão controlada baseada em backup).
 * 7. Compara o estado pós-recuperação com o estado pré-migração inicial (deep equality).
 * 8. Remove dados sintéticos do laboratório.
 * 9. Emite MIGRATION_RECOVERY_REHEARSAL=PASS ou FAIL.
 *
 * USO:
 *   firebase emulators:exec --project olhos-do-campus-local --only firestore "node node_modules/tsx/dist/cli.mjs scripts/backup/rehearsalMigration.ts"
 */

import { initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { planMigration080, type OperationalTeamData } from '../migrate080';
import { INITIAL_INTAKE_TEAM } from '../../server/repositories/referenceSeedData';

interface InitialState {
  teams: OperationalTeamData[];
  adminUsers: Array<{ id: string; email: string; role: string; legacyRole: boolean }>;
}

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'olhos-do-campus-local';

function assertEmulator(): void {
  if (!EMULATOR_HOST) {
    console.error('[rehearsalMigration] ERRO DE SEGURANÇA: FIRESTORE_EMULATOR_HOST não definido.');
    console.error('MIGRATION_RECOVERY_REHEARSAL=EMULATOR_REQUIRED');
    process.exit(2);
  }
}

async function main(): Promise<void> {
  console.log('========================================================');
  console.log('  G09B-F014 — Rehearsal de Recuperação de Migração');
  console.log('========================================================');
  assertEmulator();

  const app: App = initializeApp({ projectId: PROJECT_ID }, 'migration-rehearsal-' + Date.now());
  const db: Firestore = getFirestore(app);

  const initialData: InitialState = {
    teams: [
      {
        id: 'team-infra-predial-rehearsal',
        name: 'Equipe Predial Rehearsal',
        description: 'Manutenção civil pré-migração',
        notificationEmail: 'predial@rehearsal.local',
        isInitialIntakeTeam: true, // antigo initial intake incorreto
        active: true,
        sortOrder: 10,
        schemaVersion: 1, // esquema legado v1
      },
      {
        id: 'team-eletrica-rehearsal',
        name: 'Equipe Elétrica Rehearsal',
        description: 'Instalações elétricas pré-migração',
        notificationEmail: 'eletrica@rehearsal.local',
        isInitialIntakeTeam: false,
        active: true,
        sortOrder: 20,
        schemaVersion: 1,
      },
    ],
    adminUsers: [
      {
        id: 'user-legacy-atendente-rehearsal',
        email: 'atendente@rehearsal.local',
        role: 'Atendente',
        legacyRole: true,
      },
    ],
  };

  console.log('\n[Passo 1] Gravando estado pré-migração sintético no Emulator...');
  const seedBatch = db.batch();
  for (const team of initialData.teams) {
    seedBatch.set(db.collection('operationalTeams').doc(team.id), team);
  }
  for (const user of initialData.adminUsers) {
    seedBatch.set(db.collection('adminUsers').doc(user.id), user);
  }
  await seedBatch.commit();
  console.log('  ✓ Estado inicial persistido.');

  console.log('\n[Passo 2] Capturando preimage / backup pré-migração...');
  const preimageTeamsSnap = await db.collection('operationalTeams').get();
  const preimageTeams: Record<string, OperationalTeamData> = {};
  for (const d of preimageTeamsSnap.docs) {
    const data = d.data();
    preimageTeams[d.id] = {
      id: d.id,
      name: typeof data.name === 'string' ? data.name : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      notificationEmail: typeof data.notificationEmail === 'string' ? data.notificationEmail : undefined,
      isInitialIntakeTeam: typeof data.isInitialIntakeTeam === 'boolean' ? data.isInitialIntakeTeam : undefined,
      active: typeof data.active === 'boolean' ? data.active : undefined,
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
      schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined,
    };
  }

  interface PreimageUser {
    id: string;
    email?: string;
    role?: string;
    legacyRole?: boolean;
  }
  const preimageUsersSnap = await db.collection('adminUsers').get();
  const preimageUsers: Record<string, PreimageUser> = {};
  for (const d of preimageUsersSnap.docs) {
    const data = d.data();
    preimageUsers[d.id] = {
      id: d.id,
      email: typeof data.email === 'string' ? data.email : undefined,
      role: typeof data.role === 'string' ? data.role : undefined,
      legacyRole: typeof data.legacyRole === 'boolean' ? data.legacyRole : undefined,
    };
  }
  console.log(`  ✓ Preimage capturado: ${Object.keys(preimageTeams).length} equipes, ${Object.keys(preimageUsers).length} usuários.`);

  console.log('\n[Passo 3] Executando Migration Apply (0.8.0) no laboratório...');
  const currentTeamsList: OperationalTeamData[] = Object.values(preimageTeams);
  const legacyUsersList = Object.values(preimageUsers);

  const plan = planMigration080(currentTeamsList, legacyUsersList, 'APPLY');
  console.log(`  Plan: ${plan.teamUpdatesCount} atualizações de equipe necessárias.`);

  const migrationBatch = db.batch();
  for (const update of plan.teamUpdates) {
    const ref = db.collection('operationalTeams').doc(update.id);
    if (update.isCreate) {
      migrationBatch.set(ref, {
        ...update.patch,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      migrationBatch.set(ref, { ...update.patch, updatedAt: new Date() }, { merge: true });
    }
  }
  await migrationBatch.commit();
  console.log('  ✓ Migração aplicada com sucesso.');

  console.log('\n[Passo 4] Validando que estado migrado foi modificado...');
  const migratedCgao = await db.collection('operationalTeams').doc(INITIAL_INTAKE_TEAM.id).get();
  if (!migratedCgao.exists) {
    throw new Error('Falha: CGAO não foi criada durante a migração.');
  }
  const migratedTeamA = await db.collection('operationalTeams').doc('team-infra-predial-rehearsal').get();
  if (migratedTeamA.data()?.isInitialIntakeTeam !== false) {
    throw new Error('Falha: Team A ainda é initial intake.');
  }
  console.log('  ✓ Mutação de migração confirmada.');

  console.log('\n[Passo 5] Executando Recovery a partir do Preimage (Restauração do Backup)...');
  // Deletar documentos criados pela migração que não existiam no preimage
  const postMigrationTeamsSnap = await db.collection('operationalTeams').get();
  const recoveryBatch = db.batch();

  for (const d of postMigrationTeamsSnap.docs) {
    if (!preimageTeams[d.id]) {
      // Documento criado pela migração: remover
      recoveryBatch.delete(d.ref);
    } else {
      // Documento modificado pela migração: restaurar estado original do preimage
      recoveryBatch.set(d.ref, preimageTeams[d.id], { merge: false });
    }
  }
  await recoveryBatch.commit();
  console.log('  ✓ Recovery aplicado a partir do preimage.');

  console.log('\n[Passo 6] Comparando estado pós-recuperação com o estado pré-migração...');
  const recoveredTeamsSnap = await db.collection('operationalTeams').get();
  const recoveredMap: Record<string, OperationalTeamData> = {};
  for (const d of recoveredTeamsSnap.docs) {
    const data = d.data();
    recoveredMap[d.id] = {
      id: d.id,
      name: typeof data.name === 'string' ? data.name : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      notificationEmail: typeof data.notificationEmail === 'string' ? data.notificationEmail : undefined,
      isInitialIntakeTeam: typeof data.isInitialIntakeTeam === 'boolean' ? data.isInitialIntakeTeam : undefined,
      active: typeof data.active === 'boolean' ? data.active : undefined,
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
      schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined,
    };
  }

  // Verifica que CGAO não existe mais
  if (recoveredMap[INITIAL_INTAKE_TEAM.id]) {
    throw new Error('Falha: CGAO ainda existe após recovery.');
  }

  // Verifica cada campo do preimage original
  const fieldsToVerify: Array<keyof OperationalTeamData> = [
    'id',
    'name',
    'description',
    'notificationEmail',
    'isInitialIntakeTeam',
    'active',
    'sortOrder',
    'schemaVersion',
  ];

  for (const [id, originalDoc] of Object.entries(preimageTeams)) {
    const recoveredDoc = recoveredMap[id];
    if (!recoveredDoc) {
      throw new Error(`Falha: Equipe ${id} ausente no estado recuperado.`);
    }
    for (const field of fieldsToVerify) {
      if (recoveredDoc[field] !== originalDoc[field]) {
        throw new Error(
          `Divergência no campo ${String(field)} da equipe ${id}: esperado ${JSON.stringify(originalDoc[field])}, obtido ${JSON.stringify(recoveredDoc[field])}`
        );
      }
    }
  }
  console.log('  ✓ Correspondência 100% exata entre o estado pré-migração e o estado pós-recovery.');

  console.log('\n[Limpeza] Removendo dados de rehearsal...');
  const cleanBatch = db.batch();
  for (const d of recoveredTeamsSnap.docs) {
    cleanBatch.delete(d.ref);
  }
  for (const user of initialData.adminUsers) {
    cleanBatch.delete(db.collection('adminUsers').doc(user.id));
  }
  await cleanBatch.commit();
  console.log('  ✓ Limpeza concluída.');

  console.log('\n======================================================');
  console.log('  Resultado do Rehearsal de Recuperação');
  console.log('======================================================');
  console.log('  seed_pre_migration : OK');
  console.log('  preimage_capture   : OK');
  console.log('  migration_apply    : OK');
  console.log('  recovery_restore   : OK');
  console.log('  state_comparison   : 100% MATCH');
  console.log('\nMIGRATION_RECOVERY_REHEARSAL=PASS\n');
}

main().catch((err) => {
  console.error('[rehearsalMigration] ERRO:', err);
  console.error('\nMIGRATION_RECOVERY_REHEARSAL=FAIL\n');
  process.exit(1);
});
