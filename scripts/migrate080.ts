import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { INITIAL_INTAKE_TEAM } from '../server/repositories/referenceSeedData';

export interface OperationalTeamData {
  id: string;
  name?: string;
  description?: string;
  notificationEmail?: string;
  isInitialIntakeTeam?: boolean;
  active?: boolean;
  sortOrder?: number;
  memberAdminUserIds?: string[];
  schemaVersion?: number;
  createdAt?: string | FirebaseFirestore.Timestamp | Date;
  createdBy?: string;
  updatedAt?: string | FirebaseFirestore.Timestamp | Date;
  updatedBy?: string;
}

export interface TeamMigrationPatch {
  id: string;
  isCreate: boolean;
  patch: Partial<OperationalTeamData>;
  previousState?: Partial<OperationalTeamData>;
}

export interface MigrationPlanReport {
  mode: 'DRY_RUN' | 'APPLY';
  totalTeams: number;
  cgaoExists: boolean;
  cgaoActive: boolean;
  cgaoNameCorrect: boolean;
  cgaoEmailCorrect: boolean;
  cgaoSchemaCorrect: boolean;
  currentInitialIntakeCount: number;
  currentInitialIntakeTeamIds: string[];
  teamUpdatesCount: number;
  teamUpdates: TeamMigrationPatch[];
  expectedPostMigrationInitialIntakeCount: 1;
  legacyUsersCount: number;
  legacyUsers: Array<{
    id: string;
    email?: string;
    role?: string;
    legacyRole?: boolean;
  }>;
}

export function planMigration080(
  existingTeams: OperationalTeamData[],
  legacyUsers: Array<{ id: string; email?: string; role?: string; legacyRole?: boolean }> = [],
  mode: 'DRY_RUN' | 'APPLY' = 'DRY_RUN'
): MigrationPlanReport {
  const cgao = existingTeams.find((t) => t.id === INITIAL_INTAKE_TEAM.id);
  const cgaoExists = cgao !== undefined;
  const cgaoActive = cgao?.active === true;
  const cgaoNameCorrect = cgao?.name === INITIAL_INTAKE_TEAM.name;
  const cgaoEmailCorrect = cgao?.notificationEmail === INITIAL_INTAKE_TEAM.notificationEmail;
  const cgaoSchemaCorrect = cgao?.schemaVersion === 2;

  const currentInitialIntakeTeams = existingTeams.filter(
    (t) => t.active !== false && t.isInitialIntakeTeam === true
  );
  const currentInitialIntakeCount = currentInitialIntakeTeams.length;
  const currentInitialIntakeTeamIds = currentInitialIntakeTeams.map((t) => t.id);

  const teamUpdates: TeamMigrationPatch[] = [];

  if (!cgaoExists) {
    teamUpdates.push({
      id: INITIAL_INTAKE_TEAM.id,
      isCreate: true,
      patch: {
        id: INITIAL_INTAKE_TEAM.id,
        schemaVersion: 2,
        name: INITIAL_INTAKE_TEAM.name,
        description: INITIAL_INTAKE_TEAM.description,
        notificationEmail: INITIAL_INTAKE_TEAM.notificationEmail,
        isInitialIntakeTeam: true,
        active: true,
        sortOrder: INITIAL_INTAKE_TEAM.sortOrder,
        memberAdminUserIds: [],
      },
    });
  } else {
    const cgaoPatch: Partial<OperationalTeamData> = {};
    if (cgao.schemaVersion !== 2) cgaoPatch.schemaVersion = 2;
    if (cgao.name !== INITIAL_INTAKE_TEAM.name) cgaoPatch.name = INITIAL_INTAKE_TEAM.name;
    if (cgao.active !== true) cgaoPatch.active = true;
    if (cgao.notificationEmail !== INITIAL_INTAKE_TEAM.notificationEmail) {
      cgaoPatch.notificationEmail = INITIAL_INTAKE_TEAM.notificationEmail;
    }
    if (cgao.isInitialIntakeTeam !== true) cgaoPatch.isInitialIntakeTeam = true;

    if (Object.keys(cgaoPatch).length > 0) {
      teamUpdates.push({
        id: cgao.id,
        isCreate: false,
        patch: cgaoPatch,
        previousState: {
          name: cgao.name,
          active: cgao.active,
          notificationEmail: cgao.notificationEmail,
          isInitialIntakeTeam: cgao.isInitialIntakeTeam,
          schemaVersion: cgao.schemaVersion,
        },
      });
    }
  }

  for (const team of existingTeams) {
    if (team.id === INITIAL_INTAKE_TEAM.id) continue;

    const patch: Partial<OperationalTeamData> = {};
    if (team.schemaVersion !== 2) patch.schemaVersion = 2;
    if (team.isInitialIntakeTeam !== false) {
      patch.isInitialIntakeTeam = false;
    }

    if (Object.keys(patch).length > 0) {
      teamUpdates.push({
        id: team.id,
        isCreate: false,
        patch,
        previousState: {
          isInitialIntakeTeam: team.isInitialIntakeTeam,
          schemaVersion: team.schemaVersion,
        },
      });
    }
  }

  return {
    mode,
    totalTeams: existingTeams.length,
    cgaoExists,
    cgaoActive,
    cgaoNameCorrect,
    cgaoEmailCorrect,
    cgaoSchemaCorrect,
    currentInitialIntakeCount,
    currentInitialIntakeTeamIds,
    teamUpdatesCount: teamUpdates.length,
    teamUpdates,
    expectedPostMigrationInitialIntakeCount: 1,
    legacyUsersCount: legacyUsers.length,
    legacyUsers,
  };
}

export function executeMigrationOnMemory(
  teams: OperationalTeamData[],
  plan: MigrationPlanReport
): OperationalTeamData[] {
  const result: OperationalTeamData[] = teams.map((t) => ({ ...t }));
  for (const update of plan.teamUpdates) {
    if (update.isCreate) {
      result.push({
        ...(update.patch as OperationalTeamData),
        createdAt: new Date().toISOString(),
        createdBy: 'migration-0.8.0',
        updatedAt: new Date().toISOString(),
        updatedBy: 'migration-0.8.0',
      });
    } else {
      const idx = result.findIndex((t) => t.id === update.id);
      if (idx >= 0) {
        result[idx] = {
          ...result[idx]!,
          ...update.patch,
          updatedAt: new Date().toISOString(),
          updatedBy: 'migration-0.8.0',
        };
      }
    }
  }
  return result;
}

async function runCli(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  if (args.has('--dry-run') && apply) throw new Error('Use apenas --dry-run ou --apply.');
  if (!SERVER_ENV.emulatorMode && apply && process.env.ALLOW_080_MIGRATION !== 'CONFIRM_MIGRATION_0_8') {
    throw new Error('Migração fora do Emulator Suite bloqueada. Defina ALLOW_080_MIGRATION=CONFIRM_MIGRATION_0_8 somente após backup e conferência do projeto de destino.');
  }

  // G09B-F014 — guard de backup confirmado
  if (apply && process.env.BACKUP_CONFIRMED !== 'CONFIRM_BACKUP_PRE_MIGRATION') {
    throw new Error(
      'Backup pré-migração não confirmado. ' +
      'Defina BACKUP_CONFIRMED=CONFIRM_BACKUP_PRE_MIGRATION após realizar backup ' +
      'das coleções operationalTeams e adminUsers. ' +
      'Use scripts/migrationManifest.ts --apply para gerar o preimage local.'
    );
  }

  const { firestore } = getFirebaseAdminServices(SERVER_ENV);

  const teamsSnapshot = await firestore.collection('operationalTeams').get();
  const adminUsersSnapshot = await firestore.collection('adminUsers').get();

  const existingTeams: OperationalTeamData[] = teamsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Partial<OperationalTeamData>),
  }));

  const legacyUsers = adminUsersSnapshot.docs
    .filter((doc) => {
      const data = doc.data() as { legacyRole?: boolean; role?: string };
      return data.legacyRole === true || data.role === 'Atendente';
    })
    .map((doc) => {
      const data = doc.data() as { email?: string; role?: string; legacyRole?: boolean };
      return { id: doc.id, email: data.email, role: data.role, legacyRole: data.legacyRole };
    });

  const plan = planMigration080(existingTeams, legacyUsers, apply ? 'APPLY' : 'DRY_RUN');

  console.log('=== RELATÓRIO DE MIGRAÇÃO 0.8.0 ===');
  console.log(JSON.stringify(plan, null, 2));

  if (!apply) {
    console.log('\n[DRY-RUN] Nenhuma alteração aplicada. Execute com --apply para persistir as alterações.');
    return;
  }

  const batch = firestore.batch();

  for (const update of plan.teamUpdates) {
    const docRef = firestore.collection('operationalTeams').doc(update.id);
    if (update.isCreate) {
      batch.set(docRef, {
        ...update.patch,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[APPLY] Criando equipe ${update.id}:`, update.patch);
    } else {
      batch.set(
        docRef,
        {
          ...update.patch,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      console.log(`[APPLY] Atualizando equipe ${update.id}:`, update.patch);
    }
  }

  await batch.commit();
  console.log('\n[APPLY] Migração 0.8.0 concluída com sucesso.');
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  void runCli();
}
