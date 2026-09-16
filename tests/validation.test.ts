import { describe, expect, it } from 'vitest';
import { parsePort } from '../server/config/port';
import { createOccurrenceSchema, validateOccurrenceForm } from '../src/validators/occurrence';
import { trackingSchema } from '../src/validators/tracking';

describe('validação pública e de ambiente', () => {
  it('rejeita formulário sem identificadores estáveis e descrição suficiente', () => {
    const errors = validateOccurrenceForm({ location: { campusId: '', buildingId: '', floorId: '', roomId: '' }, categoryId: '', description: 'curta', immediateRisk: false });
    expect(errors['location.campusId']).toBeDefined();
    expect(errors.categoryId).toBeDefined();
    expect(errors.description).toBeDefined();
  });
  it('aceita um registro estruturalmente válido', () => {
    expect(createOccurrenceSchema.safeParse({ location: { campusId: 'campus', buildingId: 'bloco', floorId: 'terreo', roomId: 'sala-1' }, categoryId: 'cat-iluminacao', description: 'A luminária do ambiente não acende durante o período noturno.', immediateRisk: false }).success).toBe(true);
  });
  it('exige protocolo e chave nos formatos previstos, aceitando prefixo composto', () => {
    expect(trackingSchema.safeParse({ protocol: 'INF-BSF-2026-000001', trackingKey: 'ABCD-EFGH-IJKL' }).success).toBe(true);
    expect(trackingSchema.safeParse({ protocol: 'INF-2026-1', trackingKey: 'sem-chave' }).success).toBe(false);
  });
  it('valida PORT como inteiro TCP e usa 3000 como padrão', () => {
    expect(parsePort(undefined, 3000)).toBe(3000);
    expect(parsePort('8080', 3000)).toBe(8080);
    for (const invalid of ['0', '65536', '3000.5', 'abc']) expect(() => parsePort(invalid, 3000)).toThrow(/PORT/iu);
  });
});
