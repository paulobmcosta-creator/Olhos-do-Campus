import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../src/models/occurrence';
import type { StoredOccurrence } from '../server/models/occurrenceDomain';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('Papel Atendente (RBAC e Menor Privilégio) - 0.8.0', () => {
  it('Atendente só visualiza ocorrências atribuídas a ele na listagem e na contagem', async () => {
    const { service, occurrences, administrator, manager, attendant, secondAttendant } = makeOccurrenceServiceFixture();

    const res1 = await service.create(createInput, 'c1');
    await service.create(createInput, 'c2');
    const occ1 = (await occurrences.findByProtocol(res1.protocol))!;


    // Assign occ1 to attendant
    await service.update(occ1.id, {
      expectedVersion: occ1.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
    }, manager, 'm1');

    // Admin sees all
    const adminList = await service.list({}, administrator);
    expect(adminList.items).toHaveLength(2);

    // Attendant sees only occ1
    const attendantList = await service.list({}, attendant);
    expect(attendantList.items).toHaveLength(1);
    expect(attendantList.items[0]!.id).toBe(occ1.id);

    // Second attendant (not assigned) sees none
    const secondAttendantList = await service.list({}, secondAttendant);
    expect(secondAttendantList.items).toHaveLength(0);

    // Stats are also scoped
    const attendantStats = await service.getStats(attendant);
    expect(attendantStats.withoutRouting).toBe(0);
    expect(attendantStats.receivedToday).toBe(0);

  });

  it('Atendente recebe 403 Forbidden ao tentar acessar diretamente ocorrência não atribuída', async () => {
    const { service, occurrences, attendant } = makeOccurrenceServiceFixture();
    const res = await service.create(createInput, 'c1');
    const occ = (await occurrences.findByProtocol(res.protocol))!;

    await expect(service.getById(occ.id, attendant)).rejects.toThrowError(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' })
    );
  });

  it('Atendente é impedido de alterar prioridade, categoria, local, equipe ou responsável', async () => {
    const { service, occurrences, manager, attendant } = makeOccurrenceServiceFixture();
    const res = await service.create(createInput, 'c1');
    let occ: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res.protocol))!;

    // Transition from Recebida -> Em triagem -> Em análise
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em triagem',
    }, manager, 'm0'));

    const assigned = (await service.update(occ.id, {
      expectedVersion: occ.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
      status: 'Em análise',
    }, manager, 'm1'));

    // Attempt to change priority
    await expect(service.update(assigned.id, {
      expectedVersion: assigned.version,
      priority: 'Urgente',
    }, attendant, 'att1')).rejects.toThrowError(/permissão para alterar a prioridade/);

    // Attempt to change category
    await expect(service.update(assigned.id, {
      expectedVersion: assigned.version,
      categoryId: 'cat-hidraulica',
      categoryChangeReason: 'Justificativa de teste com mais de dez caracteres',
    }, attendant, 'att1')).rejects.toThrowError(/permissão para recategorizar/);

    // Attempt to change location
    await expect(service.update(assigned.id, {
      expectedVersion: assigned.version,
      location: { campusId: 'ifes-bsf', buildingId: 'bloco-02', floorId: 'sem-pavimento', roomId: 'sala-de-aula-7' },
      locationChangeReason: 'Justificativa de teste com mais de dez caracteres',
    }, attendant, 'att1')).rejects.toThrowError(/permissão para alterar o local/);

    // Attempt to change team
    await expect(service.update(assigned.id, {
      expectedVersion: assigned.version,
      assignedTeamId: 'team-cgao',
    }, attendant, 'att1')).rejects.toThrowError(/permissão para alterar a equipe responsável/);

    // Attempt to change assignee
    await expect(service.update(assigned.id, {
      expectedVersion: assigned.version,
      assignedToAdminUserId: null,
    }, attendant, 'att1')).rejects.toThrowError(/permissão para reatribuir o responsável/);
  });

  it('Atendente executa com sucesso as 7 transições de status permitidas', async () => {
    const { service, occurrences, manager, attendant } = makeOccurrenceServiceFixture();

    // 1. Em análise -> Em atendimento
    const res1 = await service.create(createInput, 'c1');
    let occ: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res1.protocol))!;
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em triagem',
    }, manager, 'm0'));
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
      status: 'Em análise',
    }, manager, 'm1'));

    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em atendimento',
    }, attendant, 'att1'));
    expect(occ.status).toBe('Em atendimento');

    // 2. Em atendimento -> Aguardando material
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Aguardando material',
    }, attendant, 'att2'));
    expect(occ.status).toBe('Aguardando material');

    // 3. Aguardando material -> Em atendimento
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em atendimento',
    }, attendant, 'att3'));
    expect(occ.status).toBe('Em atendimento');

    // 4. Em atendimento -> Aguardando contratação ou serviço externo
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Aguardando contratação ou serviço externo',
    }, attendant, 'att4'));
    expect(occ.status).toBe('Aguardando contratação ou serviço externo');

    // 5. Aguardando contratação ou serviço externo -> Em atendimento
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em atendimento',
    }, attendant, 'att5'));
    expect(occ.status).toBe('Em atendimento');

    // 6. Em atendimento -> Resolvida
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Resolvida',
    }, attendant, 'att6'));
    expect(occ.status).toBe('Resolvida');

    // 7. Encaminhada ao setor responsável -> Em atendimento
    const res2 = await service.create(createInput, 'c2');
    let occ2: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res2.protocol))!;
    occ2 = (await service.update(occ2.id, {
      expectedVersion: occ2.version,
      status: 'Em triagem',
    }, manager, 'm2_0'));
    occ2 = (await service.update(occ2.id, {
      expectedVersion: occ2.version,
      status: 'Em análise',
    }, manager, 'm2_1'));
    occ2 = (await service.update(occ2.id, {
      expectedVersion: occ2.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
      status: 'Encaminhada ao setor responsável',
    }, manager, 'm2_2'));

    occ2 = (await service.update(occ2.id, {
      expectedVersion: occ2.version,
      status: 'Em atendimento',
    }, attendant, 'att7'));
    expect(occ2.status).toBe('Em atendimento');
  });

  it('Atendente é bloqueado ao tentar transições de status não autorizadas', async () => {
    const { service, occurrences, manager, attendant } = makeOccurrenceServiceFixture();

    const res = await service.create(createInput, 'c1');
    let occ: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res.protocol))!;
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
    }, manager, 'm1'));

    // Recebida -> Resolvida is blocked for Atendente
    await expect(service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Resolvida',
    }, attendant, 'att1')).rejects.toThrowError(/não possui permissão para transitar de “Recebida” para “Resolvida”/);

    // Transition to Em análise then Em atendimento
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em triagem',
    }, manager, 'm2'));
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em análise',
    }, manager, 'm3'));
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Em atendimento',
    }, attendant, 'att2'));

    // Em atendimento -> Cancelada is blocked for Atendente
    await expect(service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Cancelada',
    }, attendant, 'att3')).rejects.toThrowError(/não possui permissão para transitar de “Em atendimento” para “Cancelada”/);

    // Em atendimento -> Não procedente is blocked for Atendente
    await expect(service.update(occ.id, {
      expectedVersion: occ.version,
      status: 'Não procedente',
    }, attendant, 'att4')).rejects.toThrowError(/não possui permissão para transitar de “Em atendimento” para “Não procedente”/);
  });

  it('Atendente só visualiza observações internas com audiência RESPONSIBLE_TEAM em sua ocorrência', async () => {
    const { service, occurrences, manager, administrator, attendant } = makeOccurrenceServiceFixture();

    const res = await service.create(createInput, 'c1');
    let occ: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res.protocol))!;
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
      newInternalNote: 'Nota confidencial da administração',
      internalNoteAudience: 'ADMIN_ONLY',
    }, administrator, 'admin1'));

    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      newInternalNote: 'Nota para gestores e administradores',
      internalNoteAudience: 'ADMINS_AND_MANAGERS',
    }, manager, 'm1'));

    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      newInternalNote: 'Nota para a equipe responsável',
      internalNoteAudience: 'RESPONSIBLE_TEAM',
    }, manager, 'm2'));

    // Admin sees all 3 notes
    const adminView = await service.getById(occ.id, administrator);
    expect(adminView.internalNotes).toHaveLength(3);

    // Manager sees 2 notes (ADMINS_AND_MANAGERS and RESPONSIBLE_TEAM)
    const managerView = await service.getById(occ.id, manager);
    expect(managerView.internalNotes).toHaveLength(2);

    // Attendant sees only 1 note (RESPONSIBLE_TEAM)
    const attendantView = await service.getById(occ.id, attendant);
    expect(attendantView.internalNotes).toHaveLength(1);
    expect(attendantView.internalNotes[0]!.note).toBe('Nota para a equipe responsável');
    expect(attendantView.internalNotes[0]!.audience).toBe('RESPONSIBLE_TEAM');
  });

  it('Atendente é impedido de criar notas com audiências ADMIN_ONLY ou ADMINS_AND_MANAGERS', async () => {
    const { service, occurrences, manager, attendant } = makeOccurrenceServiceFixture();

    const res = await service.create(createInput, 'c1');
    let occ: StoredOccurrence | Occurrence = (await occurrences.findByProtocol(res.protocol))!;
    occ = (await service.update(occ.id, {
      expectedVersion: occ.version,
      assignedTeamId: 'team-admin',
      assignedToAdminUserId: attendant.id,
    }, manager, 'm1'));

    await expect(service.update(occ.id, {
      expectedVersion: occ.version,
      newInternalNote: 'Tentativa indevida de nota restrita',
      internalNoteAudience: 'ADMIN_ONLY',
    }, attendant, 'att1')).rejects.toThrowError(/direcionadas à equipe responsável/);

    await expect(service.update(occ.id, {
      expectedVersion: occ.version,
      newInternalNote: 'Tentativa indevida de nota de gestor',
      internalNoteAudience: 'ADMINS_AND_MANAGERS',
    }, attendant, 'att2')).rejects.toThrowError(/direcionadas à equipe responsável/);
  });
});
