import { describe, expect, it } from 'vitest';
import { InMemoryAdminUserRepository } from '../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { OperationalAdminService } from '../server/services/operationalAdminService';
import { ConfigService } from '../server/services/configService';
import { FakeCategoryRepository, FakeLocationRepository, FakeOccurrenceEventRepository, FakeOccurrenceRepository, FakeOperationalTeamRepository, FakeSlaConfigRepository, FakeSystemConfigRepository } from './helpers/fakeRepositories';
import { profile } from './helpers/occurrenceServiceFixture';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_CATEGORIES, REFERENCE_LOCATIONS } from '../server/repositories/referenceSeedData';
import { makeTestPhotoService } from './helpers/fakePhotoInfrastructure';
import { OccurrenceService } from '../server/services/occurrenceService';

function makeLocationAdminFixture() {
  const events = new FakeOccurrenceEventRepository();
  const photo = makeTestPhotoService();
  const occurrences = new FakeOccurrenceRepository(events, photo.metadata);
  const locations = new FakeLocationRepository(structuredClone(REFERENCE_LOCATIONS));
  const categories = new FakeCategoryRepository(structuredClone(REFERENCE_CATEGORIES));
  const systemConfig = new FakeSystemConfigRepository(structuredClone(DEFAULT_OPERATIONAL_CONFIG));
  const administrator = profile('Administrador', 'admin@ifes.edu.br');
  const manager = profile('Gestor', 'gestor@ifes.edu.br');
  const adminUsers = new InMemoryAdminUserRepository([]);
  const auditLogs = new InMemoryAuditLogRepository();
  const teams = new FakeOperationalTeamRepository([]);
  const sla = new FakeSlaConfigRepository();

  const occurrenceService = new OccurrenceService(
    occurrences,
    events,
    categories,
    locations,
    systemConfig,
    adminUsers,
    teams,
    sla,
    auditLogs,
    photo.service
  );

  const adminService = new OperationalAdminService(
    categories,
    locations,
    teams,
    sla,
    adminUsers,
    occurrences,
    auditLogs,
    photo.service
  );

  const configService = new ConfigService(
    systemConfig,
    categories,
    locations,
    auditLogs,
    { emulatorMode: true, appCheckEnforced: false, photoStorage: 'cloudflare-r2', emailDelivery: true }
  );


  return { adminService, configService, occurrenceService, locations, occurrences, auditLogs, administrator, manager };
}

describe('Gestão de Locais, Reativação e Exclusão Segura - 0.8.0', () => {
  it('Consulta pública (bootstrap) retorna exclusivamente áreas e ambientes ativos', async () => {
    const { configService, adminService, administrator } = makeLocationAdminFixture();

    // Inactivate one area and one room
    await adminService.updateArea('ifes-bsf', 'bloco-01', { active: false, expectedVersion: 1 }, administrator, 'c1');
    await adminService.updateEnvironment('ifes-bsf', 'bloco-02', 'sala-de-aula-7', { active: false, expectedVersion: 2 }, administrator, 'c2');

    const bootstrap = await configService.getBootstrap();
    const campus = bootstrap.locations[0]!;

    // Bloco 01 was inactivated, must NOT be returned in public bootstrap
    expect(campus.buildings.find((b) => b.id === 'bloco-01')).toBeUndefined();

    // Bloco 02 is active, but sala-de-aula-7 was inactivated and must NOT be in its rooms
    const bloco2 = campus.buildings.find((b) => b.id === 'bloco-02')!;
    expect(bloco2).toBeDefined();
    expect(bloco2.floors[0]!.rooms.find((r) => r.id === 'sala-de-aula-7')).toBeUndefined();
  });

  it('Exclusão de ambiente sem ocorrências vinculadas é permitida e remove da estrutura', async () => {
    const { adminService, locations, administrator } = makeLocationAdminFixture();

    // Add a temporary environment
    const updated = await adminService.addEnvironment('ifes-bsf', 'bloco-01', { name: 'Ambiente Temporário', sortOrder: 99, expectedVersion: 1 }, administrator, 'c1');
    const createdRoom = updated.buildings.find((b) => b.id === 'bloco-01')!.floors[0]!.rooms.find((r) => r.name === 'Ambiente Temporário')!;

    // Delete it safely
    await adminService.deleteEnvironment('ifes-bsf', 'bloco-01', createdRoom.id, updated.version ?? 2, administrator, 'c2');

    const campus = await locations.getCampus('ifes-bsf');
    const bloco1 = campus!.buildings.find((b) => b.id === 'bloco-01')!;
    expect(bloco1.floors[0]!.rooms.find((r) => r.name === 'Ambiente Temporário')).toBeUndefined();
  });

  it('Exclusão de ambiente ou área referenciada em ocorrência é bloqueada com mensagem institucional', async () => {
    const { adminService, occurrenceService, administrator } = makeLocationAdminFixture();

    // Create an occurrence in bloco-01 / sala-de-aula-1
    await occurrenceService.create({
      location: { campusId: 'ifes-bsf', buildingId: 'bloco-01', floorId: 'sem-pavimento', roomId: 'sala-de-aula-1' },
      categoryId: 'cat-iluminacao',
      description: 'Lâmpada queimada na sala de aula 1.',
      immediateRisk: false,
    }, 'client1');

    // Attempt to delete sala-de-aula-1 -> must throw with exact institutional message
    await expect(
      adminService.deleteEnvironment('ifes-bsf', 'bloco-01', 'sala-de-aula-1', 1, administrator, 'c1')
    ).rejects.toThrowError(
      'Este local já foi utilizado em ocorrências e não pode ser excluído definitivamente. Desative-o para impedir novos registros.'
    );

    // Attempt to delete bloco-01 -> must throw with exact institutional message
    await expect(
      adminService.deleteArea('ifes-bsf', 'bloco-01', 1, administrator, 'c2')
    ).rejects.toThrowError(
      'Este local já foi utilizado em ocorrências e não pode ser excluído definitivamente. Desative-o para impedir novos registros.'
    );
  });

  it('Reativação de área e ambiente emite evento explícito de auditoria LOCATION_REACTIVATED', async () => {
    const { adminService, auditLogs, administrator } = makeLocationAdminFixture();

    // Inactivate area
    await adminService.updateArea('ifes-bsf', 'bloco-01', { active: false, expectedVersion: 1 }, administrator, 'c1');
    // Reactivate area
    await adminService.updateArea('ifes-bsf', 'bloco-01', { active: true, expectedVersion: 2 }, administrator, 'c2');

    const logs = await auditLogs.list(100);
    const reactivatedLogs = logs.filter((log) => log.eventType === 'LOCATION_REACTIVATED');
    expect(reactivatedLogs.length).toBeGreaterThanOrEqual(1);
    expect(reactivatedLogs[0]!.summary).toContain('reativado');
  });
});
