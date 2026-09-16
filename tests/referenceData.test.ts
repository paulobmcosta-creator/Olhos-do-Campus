import { describe, expect, it } from 'vitest';
import { CAMPUS_SPACES, DEFAULT_OPERATIONAL_CONFIG, DEFAULT_SERVICE_CALENDAR, DEFAULT_SLA_CONFIG, REFERENCE_CATEGORIES, REFERENCE_LOCATIONS } from '../server/repositories/referenceSeedData';
import { FakeCategoryRepository, FakeLocationRepository, FakeSystemConfigRepository } from './helpers/fakeRepositories';

describe('dados de referência institucionais 0.6.0', () => {
  it('lista somente categorias ativas e mantém os SLA-base institucionais', async () => {
    const repository = new FakeCategoryRepository([{ ...REFERENCE_CATEGORIES[0]!, active: false }, REFERENCE_CATEGORIES[1]!]);
    expect((await repository.listActive()).every((item) => item.active)).toBe(true);
    expect(REFERENCE_CATEGORIES).toHaveLength(15);
    expect(REFERENCE_CATEGORIES.find((item) => item.id === 'cat-limpeza')?.resolutionBaseBusinessHours).toBe(30);
    expect(REFERENCE_CATEGORIES.find((item) => item.id === 'cat-estrutura')?.resolutionBaseBusinessHours).toBe(160);
  });

  it('carrega exatamente os 60 ambientes institucionais sem inventar pavimentos', () => {
    const counts = Object.fromEntries(CAMPUS_SPACES.buildings.map((area) => [area.name, area.floors.flatMap((floor) => floor.rooms).length]));
    expect(counts).toEqual({ 'Bloco 01': 28, 'Bloco 02': 26, 'Bloco 03': 2, Externo: 4 });
    expect(CAMPUS_SPACES.buildings.flatMap((area) => area.floors.flatMap((floor) => floor.rooms))).toHaveLength(60);
    expect(CAMPUS_SPACES.buildings.every((area) => area.floors.length === 1 && area.floors[0]?.id === 'sem-pavimento' && area.floors[0]?.name === '')).toBe(true);
  });

  it('resolve localização por identificadores estáveis produzindo snapshot textual real', async () => {
    const repository = new FakeLocationRepository(REFERENCE_LOCATIONS);
    const snapshot = await repository.resolveSnapshot({ campusId: 'ifes-bsf', buildingId: 'bloco-01', floorId: 'sem-pavimento', roomId: 'sala-de-aula-1', complement: 'próximo à porta' });
    expect(snapshot).toMatchObject({ campusId: 'ifes-bsf', campusName: 'IFES — Campus Barra de São Francisco', buildingName: 'Bloco 01', floor: '', room: 'SALA DE AULA 1', complement: 'próximo à porta' });
  });

  it('mantém calendário e matriz de SLA padrão configuráveis', () => {
    expect(DEFAULT_SERVICE_CALENDAR.timezone).toBe('America/Sao_Paulo');
    expect(DEFAULT_SERVICE_CALENDAR.weekly.MONDAY).toEqual({ open: true, start: '09:00', end: '19:00' });
    expect(DEFAULT_SERVICE_CALENDAR.weekly.SATURDAY.open).toBe(false);
    expect(DEFAULT_SLA_CONFIG.firstResponseBusinessHours).toEqual({ Baixa: 30, Normal: 20, Alta: 10, Urgente: 4, Emergencial: 2 });
    expect(DEFAULT_SLA_CONFIG.priorityMultipliers).toEqual({ Baixa: 1.5, Normal: 1, Alta: 0.8, Urgente: 0.6, Emergencial: 0.4 });
  });


  it('seed dos 60 ambientes é idempotente e não renomeia nem apaga complemento administrativo', async () => {
    const customized=structuredClone(REFERENCE_LOCATIONS);
    const campus=customized[0]!;
    const room=campus.buildings[0]!.floors[0]!.rooms[0]!;
    room.name='DIREÇÃO DE ENSINO — AJUSTE ADMINISTRATIVO';
    campus.buildings[0]!.floors[0]!.rooms.push({ id:'ambiente-criado-pelo-admin', name:'AMBIENTE CRIADO PELO ADMIN', active:true, sortOrder:999 });
    const repository=new FakeLocationRepository(customized);
    await repository.seed(REFERENCE_LOCATIONS,'seed');
    await repository.seed(REFERENCE_LOCATIONS,'seed');
    const after=(await repository.list())[0]!;
    expect(after.buildings.flatMap(area=>area.floors.flatMap(floor=>floor.rooms)).filter(item=>item.id==='sala-de-aula-1')).toHaveLength(1);
    expect(after.buildings[0]!.floors[0]!.rooms[0]!.name).toBe('DIREÇÃO DE ENSINO — AJUSTE ADMINISTRATIVO');
    expect(after.buildings[0]!.floors[0]!.rooms.some(item=>item.id==='ambiente-criado-pelo-admin')).toBe(true);
  });

  it('configuração operacional persiste independentemente da identidade de branding', async () => {
    const repository = new FakeSystemConfigRepository(DEFAULT_OPERATIONAL_CONFIG);
    const changed = await repository.update({ ...DEFAULT_OPERATIONAL_CONFIG, protocolPrefix: 'BSF' }, 'admin');
    expect((await repository.get())?.protocolPrefix).toBe('BSF');
    expect(changed.notificationEmails).toEqual([]);
  });
});
