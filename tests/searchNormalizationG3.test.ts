import { describe, expect, it } from 'vitest';
import { extractSearchTokens, normalizeSearchKeyword, normalizeSearchText } from '../src/utils/textNormalization';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('G09C-F001: Normalização textual de busca e indexação', () => {
  describe('Função canônica de normalização textual (unitária)', () => {
    it('SEARCH_DIACRITICS_TEST — normaliza pares com diacríticos para o mesmo valor lógico', () => {
      const pairs = [
        ['eletrica', 'elétrica'],
        ['lampada', 'lâmpada'],
        ['hidraulica', 'hidráulica'],
        ['iluminacao', 'iluminação'],
        ['climatizacao', 'climatização'],
      ] as const;

      for (const [unaccented, accented] of pairs) {
        expect(normalizeSearchText(accented)).toBe(unaccented);
        expect(normalizeSearchText(unaccented)).toBe(unaccented);
        expect(normalizeSearchKeyword(accented)).toBe(unaccented);
        expect(normalizeSearchKeyword(unaccented)).toBe(unaccented);
      }
    });

    it('SEARCH_CASE_TEST — trata case-insensitivity mantendo resultado idêntico', () => {
      const variations = ['ELÉTRICA', 'Elétrica', 'elétrica', 'eletrica', 'ELETRICA'];
      for (const variation of variations) {
        expect(normalizeSearchText(variation)).toBe('eletrica');
        expect(normalizeSearchKeyword(variation)).toBe('eletrica');
      }
    });

    it('SEARCH_WHITESPACE_TEST — remove espaços excedentes e extrai token de busca limpo', () => {
      const withWhitespace = '   elétrica   ';
      expect(normalizeSearchText(withWhitespace)).toBe('eletrica');
      expect(normalizeSearchKeyword(withWhitespace)).toBe('eletrica');

      const multipleTokens = '   lâmpada   queimada  ';
      expect(normalizeSearchKeyword(multipleTokens)).toBe('lampada');
    });

    it('extração de tokens de indexação descarta termos curtos e deduplica', () => {
      const tokens = extractSearchTokens(
        'Instalação elétrica da lâmpada',
        'Elétrica',
        'Bloco Principal',
        'Sala 101',
      );
      expect(tokens).toContain('instalacao');
      expect(tokens).toContain('eletrica');
      expect(tokens).toContain('lampada');
      expect(tokens).toContain('bloco');
      expect(tokens).toContain('principal');
      expect(tokens).toContain('sala');
      expect(tokens).toContain('101');
      // "da" tem 2 letras, deve ser descartado
      expect(tokens).not.toContain('da');
    });
  });

  describe('Busca ponta-a-ponta via OccurrenceService e repositório', () => {
    it('SEARCH_DIACRITICS_TEST — busca ponta-a-ponta retorna o mesmo conjunto lógico com ou sem acento', async () => {
      const { service, manager } = makeOccurrenceServiceFixture();

      // Cria ocorrências contendo os termos dos pares homologados usando localização válida do fixture
      await service.create({
        ...createInput,
        description: 'Problema na rede elétrica e manutenção hidráulica da climatização.',
      }, 'c-create-1');

      await service.create({
        ...createInput,
        description: 'A lâmpada e a iluminação do corredor falharam.',
      }, 'c-create-2');

      const pairs = [
        ['eletrica', 'elétrica'],
        ['lampada', 'lâmpada'],
        ['hidraulica', 'hidráulica'],
        ['iluminacao', 'iluminação'],
        ['climatizacao', 'climatização'],
      ] as const;

      for (const [withoutAccent, withAccent] of pairs) {
        const resWithout = await service.list({ keyword: withoutAccent }, manager);
        const resWith = await service.list({ keyword: withAccent }, manager);

        expect(resWithout.items.length).toBeGreaterThan(0);
        expect(resWith.items.length).toBe(resWithout.items.length);

        const idsWithout = resWithout.items.map((i) => i.id).sort();
        const idsWith = resWith.items.map((i) => i.id).sort();
        expect(idsWith).toEqual(idsWithout);
      }
    });

    it('SEARCH_CASE_TEST — busca ponta-a-ponta suporta maiúsculas e minúsculas', async () => {
      const { service, manager } = makeOccurrenceServiceFixture();

      await service.create({
        ...createInput,
        description: 'Falha grave na instalação elétrica geral.',
      }, 'c-case');

      const lower = await service.list({ keyword: 'elétrica' }, manager);
      const upper = await service.list({ keyword: 'ELÉTRICA' }, manager);
      const mixed = await service.list({ keyword: 'Elétrica' }, manager);
      const plain = await service.list({ keyword: 'eletrica' }, manager);

      expect(lower.items.length).toBe(1);
      expect(upper.items.length).toBe(1);
      expect(mixed.items.length).toBe(1);
      expect(plain.items.length).toBe(1);
      expect(upper.items[0]!.id).toBe(lower.items[0]!.id);
      expect(mixed.items[0]!.id).toBe(lower.items[0]!.id);
      expect(plain.items[0]!.id).toBe(lower.items[0]!.id);
    });

    it('SEARCH_WHITESPACE_TEST — busca ponta-a-ponta tolera whitespace excedente', async () => {
      const { service, manager } = makeOccurrenceServiceFixture();

      await service.create({
        ...createInput,
        description: 'Troca de lâmpada queimada urgente.',
      }, 'c-space');

      const normal = await service.list({ keyword: 'lâmpada' }, manager);
      const padded = await service.list({ keyword: '   lâmpada   ' }, manager);
      const paddedWithoutAccent = await service.list({ keyword: '   lampada   ' }, manager);

      expect(normal.items.length).toBe(1);
      expect(padded.items.length).toBe(1);
      expect(paddedWithoutAccent.items.length).toBe(1);
      expect(padded.items[0]!.id).toBe(normal.items[0]!.id);
      expect(paddedWithoutAccent.items[0]!.id).toBe(normal.items[0]!.id);
    });
  });
});
