import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
}

interface FirestoreIndex {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  density?: 'DENSE' | 'SPARSE_ANY';
  multikey?: boolean;
  fields: IndexField[];
}

interface FirestoreIndexManifest {
  indexes: FirestoreIndex[];
  fieldOverrides?: unknown[];
}

const manifest = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as FirestoreIndexManifest;

describe('Firestore Enterprise — contrato de índices 0.7.5', () => {
  it('não usa fieldOverrides incompatíveis com o banco Enterprise homologado', () => {
    expect(manifest.fieldOverrides).toBeUndefined();
  });

  it('materializa explicitamente os seis índices collection-group de attempts', () => {
    const attempts = manifest.indexes.filter((index) => index.collectionGroup === 'attempts');
    expect(attempts).toHaveLength(6);
    expect(attempts.every((index) => index.queryScope === 'COLLECTION_GROUP')).toBe(true);
    expect(attempts.every((index) => index.density === 'DENSE')).toBe(true);
    expect(attempts.every((index) => index.multikey === false)).toBe(true);

    const signatures = attempts.map((index) => index.fields.map((field) => `${field.fieldPath}:${field.order ?? ''}`).join('|')).sort();
    expect(signatures).toEqual([
      'attemptNumber:ASCENDING',
      'createdAt:ASCENDING',
      'providerAcceptedAt:ASCENDING',
      'providerAcceptedAt:DESCENDING',
      'providerMessageId:ASCENDING',
      'status:ASCENDING',
    ]);
  });
});
