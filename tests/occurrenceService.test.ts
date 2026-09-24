import { describe, expect, it } from 'vitest';
import { isValidTrackingKeyFormat, verifyTrackingKey } from '../server/utils/trackingKey';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('serviço de ocorrências 0.6.0', () => {
  it('gera protocolo anual, preserva valores reportados e retorna a chave somente na criação', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-create');
    const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date());
    expect(created.protocol).toMatch(new RegExp(`^INF-${year}-\\d{6}$`, 'u'));
    expect(isValidTrackingKeyFormat(created.trackingKey)).toBe(true);
    const stored = await occurrences.findByProtocol(created.protocol);
    expect(stored).toBeDefined();
    expect(stored).not.toHaveProperty('trackingKey');
    expect(stored).toMatchObject({
      reportedCategoryId: 'cat-iluminacao', reportedCategoryNameSnapshot: 'Iluminação',
      categoryId: 'cat-iluminacao', categoryNameSnapshot: 'Iluminação',
      reportedLocation: { campusName: 'IFES — Campus Barra de São Francisco', buildingName: 'Bloco 01', floor: '', room: 'SALA DE AULA 1' },
      location: { campusName: 'IFES — Campus Barra de São Francisco', buildingName: 'Bloco 01', floor: '', room: 'SALA DE AULA 1' },
      priority: 'Normal', dataClassification: 'REAL', reopenedCount: 0,
    });
    expect(stored?.sla?.resolutionBaseBusinessMinutes).toBe(60 * 60);
    expect(stored?.trackingKeyHash).not.toBe(created.trackingKey);
    expect(await verifyTrackingKey(created.trackingKey, stored?.trackingKeyHash ?? '', stored?.trackingKeySalt ?? '')).toBe(true);
  });

  it('risco imediato inicia como Urgente, nunca como Emergencial', async () => {
    const { service, occurrences } = makeOccurrenceServiceFixture();
    const created = await service.create({ ...createInput, immediateRisk: true }, 'corr-risk');
    const stored = await occurrences.findByProtocol(created.protocol);
    expect(stored?.priority).toBe('Urgente');
    expect(stored?.priorityRank).toBe(2);
  });

  it('consulta com chave correta e usa resposta genérica para combinação inválida', async () => {
    const { service } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-create');
    await expect(service.track(created.protocol, created.trackingKey)).resolves.toMatchObject({ protocol: created.protocol, category: 'Iluminação' });
    await expect(service.track(created.protocol, 'AAAA-BBBB-CCCC')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    await expect(service.track('INF-2026-999999', 'AAAA-BBBB-CCCC')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('mensagem pública não define primeira resposta; primeira mudança pública de situação define exatamente uma vez', async () => {
    const { service, manager, occurrences } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-create');
    const first = (await service.list({}, manager)).items[0]!;
    const withMessage = await service.update(first.id, { expectedVersion: first.version, newPublicMessage: 'Equipe acionada.' }, manager, 'corr-message');
    expect(withMessage.firstPublicResponseAt).toBeUndefined();
    const changed = await service.update(first.id, { expectedVersion: withMessage.version, status: 'Em triagem' }, manager, 'corr-status');
    expect(changed.firstPublicResponseAt).toBeDefined();
    const initialResponse = changed.firstPublicResponseAt;
    const later = await service.update(first.id, { expectedVersion: changed.version, status: 'Em análise' }, manager, 'corr-status-2');
    expect(later.firstPublicResponseAt).toBe(initialResponse);
    expect((await occurrences.findByProtocol(created.protocol))?.sla?.firstResponseAt).toBeDefined();
  });

  it('corrige categoria e local preservando origem, justificativa, SLA, histórico e auditoria', async () => {
    const { service, manager, events, auditLogs } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-create');
    const item = (await service.list({}, manager)).items[0]!;
    const originalDue=item.sla?.resolutionDueAt;
    await expect(service.update(item.id,{expectedVersion:item.version,categoryId:'cat-eletrica'},manager,'sem-razao')).rejects.toMatchObject({status:400});
    await expect(service.update(item.id,{expectedVersion:item.version,location:{campusId:'ifes-bsf',buildingId:'bloco-02',floorId:'sem-pavimento',roomId:'laboratorio-de-informatica'}},manager,'sem-razao-local')).rejects.toMatchObject({status:400});
    const updated = await service.update(item.id, {
      expectedVersion: item.version,
      categoryId: 'cat-eletrica', categoryChangeReason: 'Triagem técnica confirmou falha na instalação elétrica.',
      location: { campusId: 'ifes-bsf', buildingId: 'bloco-02', floorId: 'sem-pavimento', roomId: 'laboratorio-de-informatica' },
      locationChangeReason: 'Vistoria confirmou que a ocorrência está no laboratório de informática.',
    }, manager, 'corr-reclass');
    expect(updated.version).toBe(item.version+1);
    expect(updated.reportedCategoryId).toBe('cat-iluminacao');
    expect(updated.categoryId).toBe('cat-eletrica');
    expect(updated.reportedLocation.buildingName).toBe('Bloco 01');
    expect(updated.reportedLocation.room).toBe('SALA DE AULA 1');
    expect(updated.location.buildingName).toBe('Bloco 02');
    expect(updated.location.room).toBe('LABORATORIO DE INFORMÁTICA');
    expect(updated.sla?.resolutionBaseBusinessMinutes).toBe(50*60);
    expect(updated.sla?.resolutionDueAt).not.toEqual(originalDue);
    const history=await events.listByOccurrenceId(item.id);
    expect(history.filter(x=>x.eventType==='CATEGORY_CHANGED')).toHaveLength(1);
    expect(history.find(x=>x.eventType==='CATEGORY_CHANGED')?.reason).toContain('Triagem técnica');
    expect(history.filter(x=>x.eventType==='LOCATION_CHANGED')).toHaveLength(1);
    expect(history.find(x=>x.eventType==='LOCATION_CHANGED')?.reason).toContain('Vistoria confirmou');
    const audit=await auditLogs.list(50);
    expect(audit.map(x=>x.eventType)).toEqual(expect.arrayContaining(['OCCURRENCE_CATEGORY_CHANGED','OCCURRENCE_LOCATION_CHANGED']));
    const publicView=await service.track(created.protocol,created.trackingKey);
    expect(publicView.category).toBe('Instalações elétricas');
    expect(publicView.location).toMatchObject({buildingName:'Bloco 02',room:'LABORATORIO DE INFORMÁTICA'});
    expect(publicView.categoryAdjusted).toBe(true);expect(publicView.locationAdjusted).toBe(true);
    expect(JSON.stringify(publicView)).not.toContain(manager.displayName);
  });

  it('persiste mensagem pública e observação interna como eventos separados', async () => {
    const { service, manager } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-create');
    const item = (await service.list({}, manager)).items[0]!;
    const updated = await service.update(item.id, { expectedVersion: item.version, newPublicMessage: 'Equipe acionada.', newInternalNote: 'Verificar estoque interno.' }, manager, 'corr-update');
    expect(updated.publicMessages.at(-1)?.message).toBe('Equipe acionada.');
    expect(updated.internalNotes.at(-1)?.note).toBe('Verificar estoque interno.');
    const publicView = await service.track(created.protocol, created.trackingKey);
    expect(JSON.stringify(publicView)).toContain('Equipe acionada.');
    expect(JSON.stringify(publicView)).not.toContain('Verificar estoque interno.');
  });

  it('permite que Gestor e Administrador classifiquem ocorrência como TEST e a exclui do dashboard', async () => {
    const { service, manager, administrator } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-test-create');
    const item = (await service.list({}, manager)).items.find((candidate) => candidate.protocol === created.protocol)!;
    expect((await service.getStats(manager)).receivedToday).toBe(1);

    const testItem = await service.update(item.id, { expectedVersion: item.version, dataClassification: 'TEST' }, manager, 'corr-test-manager');
    expect(testItem.dataClassification).toBe('TEST');
    expect((await service.getStats(manager)).receivedToday).toBe(0);

    const realItem = await service.update(testItem.id, { expectedVersion: testItem.version, dataClassification: 'REAL' }, administrator, 'corr-test-admin');
    expect(realItem.dataClassification).toBe('REAL');
    expect((await service.getStats(manager)).receivedToday).toBe(1);
  });

  it('apensa ocorrências e sincroniza tratamento operacional sem fundir os registros originais', async () => {
    const { service, manager, occurrences } = makeOccurrenceServiceFixture();
    const primaryCreated = await service.create(createInput, 'corr-attach-primary');
    const childCreated = await service.create({ ...createInput, description: 'A mesma luminária continua sem funcionar.' }, 'corr-attach-child');
    const primaryStored = await occurrences.findByProtocol(primaryCreated.protocol);
    const childStored = await occurrences.findByProtocol(childCreated.protocol);
    expect(primaryStored).toBeDefined();
    expect(childStored).toBeDefined();

    const childBefore = await service.getById(childStored!.id, manager);
    const attached = await service.update(childBefore.id, {
      expectedVersion: childBefore.version,
      attachmentTargetProtocol: primaryCreated.protocol,
      attachmentRelation: 'DUPLICATE',
      attachmentReason: 'Relatos referentes à mesma luminária do mesmo ambiente.',
    }, manager, 'corr-attach');
    expect(attached.attachedToProtocol).toBe(primaryCreated.protocol);
    expect(attached.attachmentRelation).toBe('DUPLICATE');
    expect(attached.attachmentGroup?.memberCount).toBe(2);
    expect(attached.description).toBe('A mesma luminária continua sem funcionar.');

    const childInProgress = await service.update(attached.id, { expectedVersion: attached.version, status: 'Em triagem' }, manager, 'corr-attach-status');
    const primaryInProgress = await service.getById(primaryStored!.id, manager);
    expect(primaryInProgress.status).toBe('Em triagem');
    expect(childInProgress.status).toBe('Em triagem');

    const primaryPriority = await service.update(primaryInProgress.id, { expectedVersion: primaryInProgress.version, priority: 'Alta' }, manager, 'corr-attach-priority');
    const childPriority = await service.getById(childStored!.id, manager);
    expect(primaryPriority.priority).toBe('Alta');
    expect(childPriority.priority).toBe('Alta');

    await service.update(primaryPriority.id, {
      expectedVersion: primaryPriority.version,
      newPublicMessage: 'A equipe técnica realizará o atendimento conjunto.',
      applyPublicMessageToAttached: true,
    }, manager, 'corr-attach-message');
    const childWithMessage = await service.getById(childStored!.id, manager);
    expect(childWithMessage.publicMessages.at(-1)?.message).toBe('A equipe técnica realizará o atendimento conjunto.');

    const detached = await service.update(childWithMessage.id, {
      expectedVersion: childWithMessage.version,
      attachmentTargetProtocol: null,
      attachmentReason: 'Vistoria confirmou que os registros exigem tratamentos independentes.',
    }, manager, 'corr-detach');
    expect(detached.attachedToProtocol).toBeUndefined();

    const primaryLatest = await service.getById(primaryStored!.id, manager);
    await service.update(primaryLatest.id, { expectedVersion: primaryLatest.version, status: 'Em análise' }, manager, 'corr-primary-after-detach');
    const childAfterDetach = await service.getById(childStored!.id, manager);
    expect(childAfterDetach.status).toBe('Em triagem');
  });

  it('impede apensamento entre ocorrência REAL e TEST', async () => {
    const { service, manager, occurrences } = makeOccurrenceServiceFixture();
    const primary = await service.create(createInput, 'corr-real-primary');
    const child = await service.create(createInput, 'corr-test-child');
    const childStored = await occurrences.findByProtocol(child.protocol);
    const childDto = await service.getById(childStored!.id, manager);
    const testChild = await service.update(childDto.id, { expectedVersion: childDto.version, dataClassification: 'TEST' }, manager, 'corr-mark-test');

    await expect(service.update(testChild.id, {
      expectedVersion: testChild.version,
      attachmentTargetProtocol: primary.protocol,
      attachmentRelation: 'SIMILAR',
      attachmentReason: 'Registros semelhantes identificados durante a triagem operacional.',
    }, manager, 'corr-mixed-attach')).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
