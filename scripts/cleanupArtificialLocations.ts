import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { FirestoreLocationRepository, type LocationRepository } from '../server/repositories/locationRepository';
import { FirestoreOccurrenceRepository } from '../server/repositories/occurrenceRepository';

export interface ArtificialLocationTarget {
  campusId: string;
  buildingId: string;
  roomId?: string;
  expectedName?: string;
  description?: string;
}

/**
 * Allowlist explícita, auditável e versionada de alvos artificiais aprovados para conciliação.
 * Por padrão institucional, como o Gate A não estabeleceu alvos reais a excluir, a lista é vazia.
 * Locais fora de CAMPUS_SPACES (60 ambientes canônicos) NÃO são considerados artificiais automaticamente.
 */
export const ARTIFICIAL_LOCATION_TARGETS: readonly ArtificialLocationTarget[] = Object.freeze([]);

export interface LocationCleanupAction {
  type: 'DELETE_ROOM' | 'INACTIVATE_ROOM' | 'DELETE_AREA' | 'INACTIVATE_AREA';
  campusId: string;
  buildingId: string;
  buildingName: string;
  roomId?: string;
  roomName?: string;
  reason: string;
  matchedTarget: ArtificialLocationTarget;
}

export interface LocationCleanupReport {
  mode: 'DRY_RUN' | 'APPLY';
  totalApprovedTargets: number;
  totalEvaluatedTargets: number;
  totalActions: number;
  actions: LocationCleanupAction[];
  skippedTargets: Array<{
    target: ArtificialLocationTarget;
    reason: string;
  }>;
}

export interface OccurrenceReferenceChecker {
  isLocationReferenced(buildingId: string, roomId?: string): Promise<boolean>;
}

export async function planLocationCleanup(
  locations: LocationRepository,
  occurrenceChecker: OccurrenceReferenceChecker,
  targets: readonly ArtificialLocationTarget[],
  mode: 'DRY_RUN' | 'APPLY' = 'DRY_RUN'
): Promise<LocationCleanupReport> {
  const actions: LocationCleanupAction[] = [];
  const skippedTargets: Array<{ target: ArtificialLocationTarget; reason: string }> = [];

  for (const target of targets) {
    const campus = await locations.getCampus(target.campusId);
    if (!campus) {
      skippedTargets.push({ target, reason: `Campus ${target.campusId} não encontrado.` });
      continue;
    }

    const building = campus.buildings.find((b) => b.id === target.buildingId);
    if (!building) {
      skippedTargets.push({ target, reason: `Bloco/Área ${target.buildingId} não encontrado no campus ${target.campusId}.` });
      continue;
    }

    if (target.roomId) {
      const room = building.floors.flatMap((f) => f.rooms).find((r) => r.id === target.roomId);
      if (!room) {
        skippedTargets.push({ target, reason: `Ambiente ${target.roomId} não encontrado na área ${target.buildingId}.` });
        continue;
      }

      if (target.expectedName && room.name !== target.expectedName) {
        skippedTargets.push({ target, reason: `Nome do ambiente (${room.name}) diverge do esperado (${target.expectedName}).` });
        continue;
      }

      const isReferenced = await occurrenceChecker.isLocationReferenced(target.buildingId, target.roomId);
      if (isReferenced) {
        actions.push({
          type: 'INACTIVATE_ROOM',
          campusId: target.campusId,
          buildingId: target.buildingId,
          buildingName: building.name,
          roomId: room.id,
          roomName: room.name,
          reason: 'Alvo artificial explicitamente autorizado presente em histórico de ocorrências. Desativação segura realizada.',
          matchedTarget: target,
        });
      } else {
        actions.push({
          type: 'DELETE_ROOM',
          campusId: target.campusId,
          buildingId: target.buildingId,
          buildingName: building.name,
          roomId: room.id,
          roomName: room.name,
          reason: 'Alvo artificial explicitamente autorizado sem ocorrências vinculadas. Exclusão física segura permitida.',
          matchedTarget: target,
        });
      }
    } else {
      if (target.expectedName && building.name !== target.expectedName) {
        skippedTargets.push({ target, reason: `Nome da área (${building.name}) diverge do esperado (${target.expectedName}).` });
        continue;
      }

      const isReferenced = await occurrenceChecker.isLocationReferenced(target.buildingId);
      if (isReferenced) {
        actions.push({
          type: 'INACTIVATE_AREA',
          campusId: target.campusId,
          buildingId: target.buildingId,
          buildingName: building.name,
          reason: 'Alvo artificial de área explicitamente autorizado com histórico de ocorrências. Desativação segura realizada.',
          matchedTarget: target,
        });
      } else {
        actions.push({
          type: 'DELETE_AREA',
          campusId: target.campusId,
          buildingId: target.buildingId,
          buildingName: building.name,
          reason: 'Alvo artificial de área explicitamente autorizado sem ocorrências vinculadas. Exclusão física segura permitida.',
          matchedTarget: target,
        });
      }
    }
  }

  return {
    mode,
    totalApprovedTargets: targets.length,
    totalEvaluatedTargets: targets.length,
    totalActions: actions.length,
    actions,
    skippedTargets,
  };
}

export async function applyLocationCleanup(
  locations: LocationRepository,
  plan: LocationCleanupReport,
  actorId: string = 'script-cleanup'
): Promise<{ executedActions: number }> {
  let executedActions = 0;
  for (const action of plan.actions) {
    const campus = await locations.getCampus(action.campusId);
    if (!campus) continue;
    const version = campus.version ?? 1;

    if (action.type === 'DELETE_ROOM' && action.roomId) {
      await locations.deleteEnvironment(action.campusId, action.buildingId, action.roomId, version, actorId);
      executedActions += 1;
    } else if (action.type === 'INACTIVATE_ROOM' && action.roomId) {
      await locations.updateEnvironment(action.campusId, action.buildingId, action.roomId, { active: false, expectedVersion: version }, actorId);
      executedActions += 1;
    } else if (action.type === 'DELETE_AREA') {
      await locations.deleteArea(action.campusId, action.buildingId, version, actorId);
      executedActions += 1;
    } else if (action.type === 'INACTIVATE_AREA') {
      await locations.updateArea(action.campusId, action.buildingId, { active: false, expectedVersion: version }, actorId);
      executedActions += 1;
    }
  }
  return { executedActions };
}

async function runCli(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  if (args.has('--dry-run') && apply) throw new Error('Use apenas --dry-run ou --apply.');
  if (!SERVER_ENV.emulatorMode && apply && process.env.ALLOW_080_LOCATION_CLEANUP !== 'CONFIRM_LOCATION_CLEANUP_0_8') {
    throw new Error('Limpeza de locais fora do Emulator Suite bloqueada. Defina ALLOW_080_LOCATION_CLEANUP=CONFIRM_LOCATION_CLEANUP_0_8 somente após backup e conferência do projeto de destino.');
  }

  const { firestore } = getFirebaseAdminServices(SERVER_ENV);
  const locationRepo = new FirestoreLocationRepository(firestore);
  const occurrenceRepo = new FirestoreOccurrenceRepository(firestore);

  const plan = await planLocationCleanup(locationRepo, occurrenceRepo, ARTIFICIAL_LOCATION_TARGETS, apply ? 'APPLY' : 'DRY_RUN');

  console.log('=== RELATÓRIO DE CONCILIAÇÃO DE AMBIENTES INSTITUCIONAIS 0.8.0 ===');
  console.log(JSON.stringify(plan, null, 2));

  if (!apply) {
    console.log('\n[DRY-RUN] Nenhuma alteração aplicada. Execute com --apply para persistir as alterações.');
    return;
  }

  const result = await applyLocationCleanup(locationRepo, plan, 'script-cleanup');
  console.log(`\n[APPLY] Conciliação de ambientes concluída com sucesso. Total de ações executadas: ${result.executedActions}.`);
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  void runCli();
}
