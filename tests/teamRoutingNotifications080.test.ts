import { describe, expect, it } from 'vitest';
import { InMemoryAdminUserRepository } from '../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { OperationalAdminService } from '../server/services/operationalAdminService';
import { FakeCategoryRepository, FakeLocationRepository, FakeOccurrenceEventRepository, FakeOccurrenceRepository, FakeOperationalTeamRepository, FakeSlaConfigRepository } from './helpers/fakeRepositories';
import { createInput, makeOccurrenceServiceFixture, profile } from './helpers/occurrenceServiceFixture';
import { INITIAL_INTAKE_TEAM, REFERENCE_CATEGORIES, REFERENCE_LOCATIONS } from '../server/repositories/referenceSeedData';
import { makeTestPhotoService } from './helpers/fakePhotoInfrastructure';

describe('Equipe CGAO de Triagem Inicial e Notificações de Roteamento - 0.8.0', () => {
  it('Nova ocorrência é automaticamente encaminhada para team-cgao e gera outbox para cgao.bsf@ifes.edu.br', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();

    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    expect(created.assignedTeamId).toBe('team-cgao');
    expect(created.assignedTeamNameSnapshot).toBe('Coordenação Geral de Administração, Orçamento e Finanças');

    // Check outbox items
    const outbox = occurrences.outboxItems;
    const cgaoNotification = outbox.find((item) => item.recipient === 'cgao.bsf@ifes.edu.br');
    expect(cgaoNotification).toBeDefined();
    expect(cgaoNotification?.eventType).toBe('OCCURRENCE_CREATED');
  });

  it('Roteamento de equipe gera item na outbox com evento OCCURRENCE_TEAM_ROUTED', async () => {
    const { service, manager, occurrences, teams } = makeOccurrenceServiceFixture();

    // Give team-admin a notification email
    await teams.update('team-admin', { notificationEmail: 'engenharia.bsf@ifes.edu.br' }, manager.id);

    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    const updated = await service.update(created.id, {
      expectedVersion: created.version,
      assignedTeamId: 'team-admin',
    }, manager, 'm1');

    expect(updated.assignedTeamId).toBe('team-admin');

    const outbox = occurrences.outboxItems;
    const teamRoutedNotification = outbox.find((item) => item.recipient === 'engenharia.bsf@ifes.edu.br' && item.eventType === 'OCCURRENCE_TEAM_ROUTED');
    expect(teamRoutedNotification).toBeDefined();
    expect(teamRoutedNotification?.occurrenceId).toBe(created.id);
  });

  it('Atribuição de responsável individual gera item na outbox com evento OCCURRENCE_RESPONSIBLE_ASSIGNED', async () => {
    const { service, manager, occurrences } = makeOccurrenceServiceFixture();

    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    const updated = await service.update(created.id, {
      expectedVersion: created.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: manager.id,
    }, manager, 'm1');

    expect(updated.assignedToAdminUserId).toBe(manager.id);

    const outbox = occurrences.outboxItems;
    const responsibleNotification = outbox.find((item) => item.recipient === manager.email && item.eventType === 'OCCURRENCE_RESPONSIBLE_ASSIGNED');
    expect(responsibleNotification).toBeDefined();
    expect(responsibleNotification?.occurrenceId).toBe(created.id);
  });

  it('Invariantes da equipe de triagem inicial são estritamente validados no OperationalAdminService', async () => {
    const events = new FakeOccurrenceEventRepository();
    const photo = makeTestPhotoService();
    const occurrences = new FakeOccurrenceRepository(events, photo.metadata);
    const locations = new FakeLocationRepository(structuredClone(REFERENCE_LOCATIONS));
    const categories = new FakeCategoryRepository(structuredClone(REFERENCE_CATEGORIES));
    const administrator = profile('Administrador', 'admin@ifes.edu.br');
    const adminUsers = new InMemoryAdminUserRepository([]);
    const auditLogs = new InMemoryAuditLogRepository();
    const teams = new FakeOperationalTeamRepository([structuredClone(INITIAL_INTAKE_TEAM)]);
    const sla = new FakeSlaConfigRepository();

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

    // 1. Cannot create initial intake team without notification email
    await expect(
      adminService.createTeam({
        name: 'Nova Triagem',
        isInitialIntakeTeam: true,
        sortOrder: 10,
      }, administrator, 'c1')
    ).rejects.toThrowError(/A equipe inicial de acolhimento exige e-mail institucional de notificação/);

    // 2. Cannot deactivate the only active initial intake team
    await expect(
      adminService.updateTeam('team-cgao', {
        active: false,
      }, administrator, 'c2')
    ).rejects.toThrowError(/Não é permitido desativar a única equipe inicial de acolhimento ativa/);

    // 3. Cannot clear email of the active initial intake team
    await expect(
      adminService.updateTeam('team-cgao', {
        notificationEmail: '',
      }, administrator, 'c3')
    ).rejects.toThrowError(/A equipe inicial de acolhimento ativa exige e-mail institucional de notificação/);
  });

  it('GD-F001 Regressão: Notificação OCCURRENCE_RESPONSIBLE_ASSIGNED sem assignedTeamNameSnapshot omite propriedade teamName do templateData', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();
    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    // Criar ocorrência simulando estado legado/sem setor atribuído
    const occurrenceWithoutTeam = {
      ...created,
      assignedTeamId: undefined,
      assignedTeamNameSnapshot: undefined,
      assignedToAdminUserId: 'user-attendant-1',
    };

    const { createResponsibleAssignedNotificationItem } = await import('../server/domain/notificationOutbox');
    const item = createResponsibleAssignedNotificationItem(
      occurrenceWithoutTeam,
      'atendente@ifes.edu.br',
      'Atendente Operacional'
    );

    expect(item).not.toBeNull();
    expect(item?.eventType).toBe('OCCURRENCE_RESPONSIBLE_ASSIGNED');
    expect(item?.recipient).toBe('atendente@ifes.edu.br');
    expect(item?.templateData.responsibleName).toBe('Atendente Operacional');
    expect(item?.templateData.category).toBe(occurrenceWithoutTeam.categoryNameSnapshot);

    // Invariante GD-F001: a propriedade teamName NÃO pode existir com valor undefined no objeto
    expect(Object.prototype.hasOwnProperty.call(item?.templateData, 'teamName')).toBe(false);
    expect(item?.templateData.teamName).toBeUndefined();
    expect(Object.values(item?.templateData ?? {}).includes(undefined)).toBe(false);
  });

  it('GD-F001: Notificação OCCURRENCE_RESPONSIBLE_ASSIGNED com assignedTeamNameSnapshot preserva teamName no templateData', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();
    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    const { createResponsibleAssignedNotificationItem } = await import('../server/domain/notificationOutbox');
    const item = createResponsibleAssignedNotificationItem(
      created,
      'gestor@ifes.edu.br',
      'Gestor de Manutenção'
    );

    expect(item).not.toBeNull();
    expect(item?.templateData.teamName).toBe('Coordenação Geral de Administração, Orçamento e Finanças');
    expect(item?.templateData.responsibleName).toBe('Gestor de Manutenção');
    expect(Object.values(item?.templateData ?? {}).includes(undefined)).toBe(false);
  });

  it('GD-F001: Idempotência de notificação diferencia reatribuições sucessivas e protege contra retries do mesmo fato', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();
    const res = await service.create(createInput, 'client1');
    const created = (await occurrences.findByProtocol(res.protocol))!;

    const { createResponsibleAssignedNotificationItem } = await import('../server/domain/notificationOutbox');
    const item1 = createResponsibleAssignedNotificationItem(created, 'resp1@ifes.edu.br', 'Responsável 1');
    const item1Retry = createResponsibleAssignedNotificationItem(created, 'resp1@ifes.edu.br', 'Responsável 1');

    // Retry do mesmo fato gera a mesma chave de idempotência e mesmo ID
    expect(item1?.id).toBe(item1Retry?.id);
    expect(item1?.idempotencyKey).toBe(item1Retry?.idempotencyKey);

    // Reatribuição subsequente (versão incrementada) gera nova notificação
    const nextVersionOccurrence = { ...created, version: created.version + 1 };
    const item2 = createResponsibleAssignedNotificationItem(nextVersionOccurrence, 'resp1@ifes.edu.br', 'Responsável 1');
    expect(item2?.id).not.toBe(item1?.id);
    expect(item2?.idempotencyKey).not.toBe(item1?.idempotencyKey);
  });
});
