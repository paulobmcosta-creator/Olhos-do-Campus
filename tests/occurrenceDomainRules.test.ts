import { describe, expect, it } from 'vitest';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('regras de resolução, reabertura, concorrência e duplicidade', () => {
  it('resolução define resolvedAt e reabertura o remove com incremento de versão', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'c0');
    let occurrence = (await service.list({}, manager)).items[0]!;
    for (const status of ['Em triagem', 'Em análise', 'Em atendimento', 'Resolvida'] as const) occurrence = await service.update(occurrence.id, { expectedVersion: occurrence.version, status }, manager, `c-${status}`);
    expect(occurrence.resolvedAt).toBeDefined();
    const reopened = await service.update(occurrence.id, { expectedVersion: occurrence.version, status: 'Em análise' }, manager, 'c-reopen');
    expect(reopened.resolvedAt).toBeUndefined();
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

  it('rejeita A→A e A→inexistente', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create(createInput, 'a');
    const a = (await service.list({}, manager)).items[0]!;
    await service.update(a.id, { expectedVersion: a.version, status: 'Em triagem' }, manager, 'a-triage');
    const currentA = await service.getById(a.id, manager);
    await expect(service.update(a.id, { expectedVersion: currentA.version, status: 'Duplicada', duplicateOfProtocol: currentA.protocol }, manager, 'self')).rejects.toMatchObject({ status: 409 });
    await expect(service.update(a.id, { expectedVersion: currentA.version, status: 'Duplicada', duplicateOfProtocol: 'INF-2026-999999' }, manager, 'missing')).rejects.toMatchObject({ status: 409 });
  });

  it('aceita A→B e A→B→C, mas rejeita A→B→A', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    await service.create({ ...createInput, description: `${createInput.description} A.` }, 'a');
    await service.create({ ...createInput, description: `${createInput.description} B.` }, 'b');
    await service.create({ ...createInput, description: `${createInput.description} C.` }, 'c');
    let [c, b, a] = (await service.list({}, manager)).items;
    if (a === undefined || b === undefined || c === undefined) throw new Error('Fixtures ausentes.');
    a = await service.update(a.id, { expectedVersion: a.version, status: 'Em triagem' }, manager, 'a1');
    b = await service.update(b.id, { expectedVersion: b.version, status: 'Em triagem' }, manager, 'b1');
    c = await service.update(c.id, { expectedVersion: c.version, status: 'Em triagem' }, manager, 'c1');
    a = await service.update(a.id, { expectedVersion: a.version, status: 'Duplicada', duplicateOfProtocol: b.protocol }, manager, 'a-b');
    expect(a.duplicateOfProtocol).toBe(b.protocol);
    b = await service.update(b.id, { expectedVersion: b.version, status: 'Duplicada', duplicateOfProtocol: c.protocol }, manager, 'b-c');
    expect(b.duplicateOfProtocol).toBe(c.protocol);
    await expect(service.update(c.id, { expectedVersion: c.version, status: 'Duplicada', duplicateOfProtocol: a.protocol }, manager, 'c-a')).rejects.toMatchObject({ status: 409 });
  });
});
