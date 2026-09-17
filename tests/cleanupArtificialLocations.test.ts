import { describe, expect, it } from 'vitest';
import type { CampusLocation } from '../src/models/config';
import { FakeLocationRepository } from './helpers/fakeRepositories';
import {
  applyLocationCleanup,
  ARTIFICIAL_LOCATION_TARGETS,
  planLocationCleanup,
  type ArtificialLocationTarget,
  type OccurrenceReferenceChecker,
} from '../scripts/cleanupArtificialLocations';

function makeTestCampus(): CampusLocation {
  return {
    id: 'ifes-bsf',
    campusName: 'IFES Campus Barra de São Francisco',
    version: 1,
    buildings: [
      {
        id: 'bloco-01',
        name: 'Bloco Pedagógico 01',
        active: true,
        sortOrder: 1,
        floors: [
          {
            id: 'sem-pavimento',
            name: 'Piso Único',
            rooms: [
              { id: 'sala-de-aula-1', name: 'Sala de Aula 01', active: true, sortOrder: 1 },
              { id: 'sala-de-aula-2', name: 'Sala de Aula 02', active: true, sortOrder: 2 },
              { id: 'sala-legitima-nova', name: 'Laboratório Maker Inovador', active: true, sortOrder: 3 },
            ],
          },
        ],
      },
      {
        id: 'bloco-novo-legitimo',
        name: 'Novo Bloco de Pesquisa',
        active: true,
        sortOrder: 2,
        floors: [
          {
            id: 'sem-pavimento',
            name: 'Piso Único',
            rooms: [
              { id: 'lab-pesquisa-1', name: 'Laboratório de Pesquisa 01', active: true, sortOrder: 1 },
            ],
          },
        ],
      },
      {
        id: 'bloco-artificial',
        name: 'Bloco Provisório Teste Mock',
        active: true,
        sortOrder: 3,
        floors: [
          {
            id: 'sem-pavimento',
            name: 'Piso Único',
            rooms: [
              { id: 'sala-teste-mock', name: 'Sala de Teste Artificial', active: true, sortOrder: 1 },
              { id: 'sala-com-historico', name: 'Sala Artificial Usada', active: true, sortOrder: 2 },
            ],
          },
        ],
      },
    ],
  };
}

describe('Conciliação e Limpeza de Locais Artificiais (C1-F001)', () => {
  it('1. allowlist vazia padrão produz zero ações e não toca nenhum ambiente ou área', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: () => Promise.resolve(false),
    };

    const plan = await planLocationCleanup(locationRepo, checker, ARTIFICIAL_LOCATION_TARGETS, 'DRY_RUN');
    expect(plan.totalApprovedTargets).toBe(0);
    expect(plan.totalActions).toBe(0);
    expect(plan.actions).toHaveLength(0);

    const result = await applyLocationCleanup(locationRepo, plan, 'test');
    expect(result.executedActions).toBe(0);

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    expect(updatedCampus.buildings).toHaveLength(3);
  });

  it('2. ambiente novo legítimo fora dos 60 não é considerado artificial e nunca é tocado', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: () => Promise.resolve(false),
    };

    // Nenhum alvo configurado para o ambiente legítimo
    const plan = await planLocationCleanup(locationRepo, checker, [], 'DRY_RUN');
    expect(plan.actions).toHaveLength(0);

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const room = updatedCampus.buildings
      .find((b) => b.id === 'bloco-01')
      ?.floors[0]?.rooms.find((r) => r.id === 'sala-legitima-nova');
    expect(room).toBeDefined();
    expect(room?.active).toBe(true);
  });

  it('3. área nova legítima fora dos 4 blocos não é considerada artificial e nunca é tocada', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: () => Promise.resolve(false),
    };

    const plan = await planLocationCleanup(locationRepo, checker, [], 'DRY_RUN');
    expect(plan.actions).toHaveLength(0);

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const building = updatedCampus.buildings.find((b) => b.id === 'bloco-novo-legitimo');
    expect(building).toBeDefined();
    expect(building?.active).toBe(true);
  });

  it('4. alvo explicitamente autorizado sem histórico de ocorrências pode ser excluído fisicamente', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: (_buildingId, roomId) => {
        // sala-teste-mock não tem ocorrências
        if (roomId === 'sala-teste-mock') return Promise.resolve(false);
        return Promise.resolve(true);
      },
    };

    const targets: ArtificialLocationTarget[] = [
      {
        campusId: 'ifes-bsf',
        buildingId: 'bloco-artificial',
        roomId: 'sala-teste-mock',
        expectedName: 'Sala de Teste Artificial',
      },
    ];

    const plan = await planLocationCleanup(locationRepo, checker, targets, 'APPLY');
    expect(plan.totalActions).toBe(1);
    expect(plan.actions[0]!.type).toBe('DELETE_ROOM');
    expect(plan.actions[0]!.roomId).toBe('sala-teste-mock');

    const result = await applyLocationCleanup(locationRepo, plan, 'test');
    expect(result.executedActions).toBe(1);

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const rooms = updatedCampus.buildings.find((b) => b.id === 'bloco-artificial')?.floors[0]?.rooms;
    expect(rooms?.find((r) => r.id === 'sala-teste-mock')).toBeUndefined();
    // Demais salas e blocos preservados
    expect(rooms?.find((r) => r.id === 'sala-com-historico')).toBeDefined();
  });

  it('5. alvo explicitamente autorizado com histórico de ocorrências é desativado com segurança', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: (_buildingId, roomId) => {
        if (roomId === 'sala-com-historico') return Promise.resolve(true);
        return Promise.resolve(false);
      },
    };

    const targets: ArtificialLocationTarget[] = [
      {
        campusId: 'ifes-bsf',
        buildingId: 'bloco-artificial',
        roomId: 'sala-com-historico',
        expectedName: 'Sala Artificial Usada',
      },
    ];

    const plan = await planLocationCleanup(locationRepo, checker, targets, 'APPLY');
    expect(plan.totalActions).toBe(1);
    expect(plan.actions[0]!.type).toBe('INACTIVATE_ROOM');

    const result = await applyLocationCleanup(locationRepo, plan, 'test');
    expect(result.executedActions).toBe(1);

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const room = updatedCampus.buildings
      .find((b) => b.id === 'bloco-artificial')
      ?.floors[0]?.rooms.find((r) => r.id === 'sala-com-historico');
    expect(room).toBeDefined();
    expect(room?.active).toBe(false);
  });

  it('6. dry-run não muta nenhum dado do repositório', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: () => Promise.resolve(false),
    };

    const targets: ArtificialLocationTarget[] = [
      {
        campusId: 'ifes-bsf',
        buildingId: 'bloco-artificial',
        roomId: 'sala-teste-mock',
      },
    ];

    const plan = await planLocationCleanup(locationRepo, checker, targets, 'DRY_RUN');
    expect(plan.totalActions).toBe(1);
    expect(plan.mode).toBe('DRY_RUN');

    // Sem chamar applyLocationCleanup, os dados permanecem intactos
    const currentCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const room = currentCampus.buildings
      .find((b) => b.id === 'bloco-artificial')
      ?.floors[0]?.rooms.find((r) => r.id === 'sala-teste-mock');
    expect(room).toBeDefined();
    expect(room?.active).toBe(true);
  });

  it('7. itens não constantes na allowlist nunca são alterados mesmo com nomes sugestivos como teste/mock', async () => {
    const campus = makeTestCampus();
    const locationRepo = new FakeLocationRepository([campus]);
    const checker: OccurrenceReferenceChecker = {
      isLocationReferenced: () => Promise.resolve(false),
    };

    // Allowlist vazia não toca no bloco chamado "bloco-artificial"
    const plan = await planLocationCleanup(locationRepo, checker, [], 'APPLY');
    expect(plan.actions).toHaveLength(0);

    await applyLocationCleanup(locationRepo, plan, 'test');

    const updatedCampus = (await locationRepo.getCampus('ifes-bsf'))!;
    const artificialBuilding = updatedCampus.buildings.find((b) => b.id === 'bloco-artificial');
    expect(artificialBuilding).toBeDefined();
    expect(artificialBuilding?.active).toBe(true);
  });
});
