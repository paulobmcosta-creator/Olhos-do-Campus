import { describe, expect, it } from 'vitest';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('regras de resolução, reabertura e concorrência', () => {
  it('permite resolução direta e reabertura direta para qualquer situação não final', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c0');
    const occurrence = (await service.list({}, manager)).items[0]!;

    const resolved = await service.update(
      occurrence.id,
      { expectedVersion: occurrence.version, status: 'Resolvida' },
      manager,
      'c-resolve-direct',
    );
    expect(resolved.status).toBe('Resolvida');
    expect(resolved.resolvedAt).toBeDefined();

    const reopened = await service.update(
      resolved.id,
      { expectedVersion: resolved.version, status: 'Em atendimento' },
      manager,
      'c-reopen-direct',
    );
    expect(reopened.status).toBe('Em atendimento');
    expect(reopened.resolvedAt).toBeUndefined();
    expect(reopened.closedAt).toBeUndefined();
    expect(reopened.reopenedCount).toBe(1);
    expect(reopened.timeline.some((event) => event.title === 'Ocorrência reaberta')).toBe(true);
  });

  it('optimistic locking rejeita versão obsoleta', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c0');
    const original = (await service.list({}, manager)).items[0]!;
    await service.update(original.id, { expectedVersion: original.version, priority: 'Alta' }, manager, 'c1');
    await expect(service.update(original.id, { expectedVersion: original.version, newInternalNote: 'Concorrente.' }, manager, 'c2')).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('atribuição exige usuário administrativo existente, ativo e elegível', async () => {
    const { service, manager, secondManager, adminUsers } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c0');
    const original = (await service.list({}, manager)).items[0]!;
    await expect(service.update(original.id, { expectedVersion: original.version, assignedToAdminUserId: 'inexistente' }, manager, 'c1')).rejects.toMatchObject({ status: 400 });
    await adminUsers.update(secondManager.id, { active: false }, manager.id);
    await expect(service.update(original.id, { expectedVersion: original.version, assignedToAdminUserId: secondManager.id }, manager, 'c-inactive')).rejects.toMatchObject({ status: 400 });
    await adminUsers.update(secondManager.id, { active: true }, manager.id);
    const assigned = await service.update(original.id, { expectedVersion: original.version, assignedToAdminUserId: secondManager.id }, manager, 'c2');
    expect(assigned).toMatchObject({ assignedToAdminUserId: secondManager.id, assignedToDisplayNameSnapshot: 'Gestor' });
  });

  it('permite encaminhar apenas à equipe e rejeita responsável fora da equipe selecionada', async () => {
    const { service, manager, secondManager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c0');
    const original = (await service.list({}, manager)).items[0]!;
    const routed = await service.update(original.id, { expectedVersion: original.version, assignedTeamId: 'team-admin' }, manager, 'team-only');
    expect(routed.assignedTeamId).toBe('team-admin');
    expect(routed.assignedToAdminUserId).toBeUndefined();
    await expect(service.update(routed.id, { expectedVersion: routed.version, assignedToAdminUserId: secondManager.id }, manager, 'wrong-member')).rejects.toMatchObject({ status: 400 });
    const withMember = await service.update(routed.id, { expectedVersion: routed.version, assignedToAdminUserId: manager.id }, manager, 'member');
    expect(withMember.assignedToAdminUserId).toBe(manager.id);
  });

  it('permite alternar diretamente entre situações, inclusive pausa, encerramento e reabertura', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c-free');
    let occurrence = (await service.list({}, manager)).items[0]!;

    occurrence = await service.update(
      occurrence.id,
      { expectedVersion: occurrence.version, status: 'Aguardando material' },
      manager,
      'c-waiting',
    );
    expect(occurrence.status).toBe('Aguardando material');
    expect(occurrence.sla?.resolutionPaused).toBe(true);

    occurrence = await service.update(
      occurrence.id,
      { expectedVersion: occurrence.version, status: 'Cancelada' },
      manager,
      'c-cancel',
    );
    expect(occurrence.status).toBe('Cancelada');
    expect(occurrence.closedAt).toBeDefined();

    occurrence = await service.update(
      occurrence.id,
      { expectedVersion: occurrence.version, status: 'Em atendimento' },
      manager,
      'c-reopen-service',
    );
    expect(occurrence.status).toBe('Em atendimento');
    expect(occurrence.closedAt).toBeUndefined();
    expect(occurrence.sla?.resolutionPaused).toBe(false);
    expect(occurrence.reopenedCount).toBe(1);
  });
});
