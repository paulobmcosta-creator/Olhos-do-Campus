import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { eventToFirestore } from '../server/repositories/occurrenceEventRepository';

describe('serialização Firestore', () => {
  it('converte datas de domínio em Timestamp e não persiste strings ISO como data do evento', () => {
    const date = new Date('2026-08-10T12:34:56.789Z');
    const serialized = eventToFirestore({
      schemaVersion: 2,
      eventType: 'OCCURRENCE_CREATED',
      visibility: 'PUBLIC',
      createdAt: date,
      actorType: 'SYSTEM',
      actorRoleSnapshot: 'Sistema',
      publicDescription: 'Registro criado.',
      correlationId: 'serialization-test',
    });
    expect(serialized.createdAt).toBeInstanceOf(Timestamp);
    expect((serialized.createdAt as Timestamp).toDate().toISOString()).toBe(date.toISOString());
  });
});
