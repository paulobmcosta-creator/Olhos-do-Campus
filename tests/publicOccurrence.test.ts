import { describe, expect, it } from 'vitest';
import type { OccurrenceEventRecord, StoredOccurrence } from '../server/models/occurrenceDomain';
import { toPublicOccurrence } from '../server/serializers/occurrenceDto';

const occurrence: StoredOccurrence = {
  id: 'occ-1', schemaVersion: 2, protocol: 'INF-2026-000001', trackingKeyHash: 'hash-interno', trackingKeySalt: 'salt-interno',
  reportedLocation: { campusId: 'campus', campusName: 'Campus', buildingId: 'bloco', buildingName: 'Bloco A', floor: '', room: 'Sala 1' },
  location: { campusId: 'campus', campusName: 'Campus', buildingId: 'bloco', buildingName: 'Bloco A', floor: '', room: 'Sala 1' },
  reportedCategoryId: 'cat-iluminacao', reportedCategoryNameSnapshot: 'Iluminação', categoryId: 'cat-iluminacao', categoryNameSnapshot: 'Iluminação', description: 'Lâmpada sem funcionamento no ambiente indicado.', immediateRisk: false,
  status: 'Em análise', priority: 'Normal', priorityRank: 4, assignedToAdminUserId: 'admin-id', assignedToDisplayNameSnapshot: 'Servidor Específico',
  createdAt: new Date('2026-08-05T10:00:00.000Z'), updatedAt: new Date('2026-08-05T11:00:00.000Z'), version: 4, dataClassification: 'REAL', reopenedCount: 0, hasPhoto: false, searchTokens: [],
};
const events: OccurrenceEventRecord[] = [
  { id: 'public', schemaVersion: 2, eventType: 'STATUS_CHANGED', visibility: 'PUBLIC', createdAt: new Date('2026-08-05T10:00:00.000Z'), actorType: 'ADMIN', actorAdminUserId: 'admin-id', actorUid: 'uid-secreto', actorRoleSnapshot: 'Gestor', actorDisplayNameSnapshot: 'Nome Real', publicDescription: 'Situação atualizada.', correlationId: 'corr' },
  { id: 'internal', schemaVersion: 2, eventType: 'INTERNAL_NOTE_ADDED', visibility: 'INTERNAL', createdAt: new Date('2026-08-05T10:30:00.000Z'), actorType: 'ADMIN', actorUid: 'uid-secreto', actorRoleSnapshot: 'Gestor', internalDescription: 'Observação restrita.', correlationId: 'corr' },
];

describe('DTO público por lista positiva', () => {
  it('não expõe campos internos, atribuição, chave derivada ou version', () => {
    const publicView = toPublicOccurrence(occurrence, events);
    const serialized = JSON.stringify(publicView);
    for (const forbidden of ['trackingKeyHash', 'trackingKeySalt', 'assignedToAdminUserId', 'assignedToDisplayNameSnapshot', 'Servidor Específico', 'uid-secreto', 'actorUid', 'internalNotes', 'version', 'campusId', 'buildingId', 'priority']) expect(serialized).not.toContain(forbidden);
  });
  it('filtra integralmente eventos internos', () => {
    const publicView = toPublicOccurrence(occurrence, events);
    expect(publicView.timeline.map((event) => event.id)).toEqual(['public']);
    expect(JSON.stringify(publicView)).not.toContain('Observação restrita.');
  });
});
