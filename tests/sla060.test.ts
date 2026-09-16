import { describe, expect, it } from 'vitest';
import type { ServiceCalendarException } from '../src/models/operations';
import { addBusinessMinutes, businessMinutesBetween, zonedLocalToDate } from '../server/domain/businessTime';
import { calculateSlaFilterStatus, completeSla, createSlaSnapshot, effectiveResolutionMinutes, markFirstPublicResponse, pauseSla, recalculateFirstResponseBeforeResponse, recalculateResolutionSla, reopenSla, resumeSla } from '../server/domain/sla';
import { DEFAULT_SERVICE_CALENDAR, DEFAULT_SLA_CONFIG, REFERENCE_CATEGORIES } from '../server/repositories/referenceSeedData';

const tz = 'America/Sao_Paulo';
const at = (date:string,time:string) => zonedLocalToDate(date,time,tz);
const basePolicy = () => ({ calendar: structuredClone(DEFAULT_SERVICE_CALENDAR), exceptions: [] as ServiceCalendarException[] });
const exception = (date:string, type:ServiceCalendarException['type'], closed:boolean, start?:string, end?:string):ServiceCalendarException => ({ id:`ex-${date}`, schemaVersion:1, date, type, label:'Teste', closed, ...(start?{start}:{}), ...(end?{end}:{}), createdAt:'2026-08-01T00:00:00.000Z',createdBy:'test',updatedAt:'2026-08-01T00:00:00.000Z',updatedBy:'test' });
const illumination = REFERENCE_CATEGORIES.find((item)=>item.id==='cat-iluminacao')!;
const structure = REFERENCE_CATEGORIES.find((item)=>item.id==='cat-estrutura')!;

describe('relógio institucional de horas úteis 0.6.0', () => {
  it('normaliza início antes das 09h e conta segunda-feira a partir da abertura', () => {
    expect(addBusinessMinutes(at('2026-08-17','07:30'),60,basePolicy()).toISOString()).toBe(at('2026-08-17','10:00').toISOString());
  });

  it('continua no dia útil seguinte quando inicia após as 19h', () => {
    expect(addBusinessMinutes(at('2026-08-17','20:00'),60,basePolicy()).toISOString()).toBe(at('2026-08-18','10:00').toISOString());
  });

  it('atravessa a sexta-feira, sábado e domingo sem contar fim de semana', () => {
    expect(addBusinessMinutes(at('2026-08-21','18:00'),120,basePolicy()).toISOString()).toBe(at('2026-08-24','10:00').toISOString());
    expect(addBusinessMinutes(at('2026-08-22','10:00'),60,basePolicy()).toISOString()).toBe(at('2026-08-24','10:00').toISOString());
    expect(addBusinessMinutes(at('2026-08-23','10:00'),60,basePolicy()).toISOString()).toBe(at('2026-08-24','10:00').toISOString());
  });

  it('respeita feriado, recesso e dia totalmente fechado', () => {
    const policy=basePolicy(); policy.exceptions.push(exception('2026-08-18','FERIADO',true),exception('2026-08-19','RECESSO',true));
    expect(addBusinessMinutes(at('2026-08-17','18:00'),120,policy).toISOString()).toBe(at('2026-08-20','10:00').toISOString());
  });

  it('respeita horário excepcional reduzido e ampliado', () => {
    const reduced=basePolicy(); reduced.exceptions.push(exception('2026-08-18','HORARIO_ESPECIAL',false,'13:00','16:00'));
    expect(addBusinessMinutes(at('2026-08-18','09:00'),120,reduced).toISOString()).toBe(at('2026-08-18','15:00').toISOString());
    const expanded=basePolicy(); expanded.exceptions.push(exception('2026-08-18','HORARIO_ESPECIAL',false,'07:00','21:00'));
    expect(businessMinutesBetween(at('2026-08-18','07:00'),at('2026-08-18','21:00'),expanded)).toBe(14*60);
  });

  it('calcula exatamente as metas de primeira resposta por prioridade', () => {
    const created=at('2026-08-17','09:00');
    expect(createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,basePolicy()).firstResponseDueAt.toISOString()).toBe(at('2026-08-18','19:00').toISOString());
    expect(createSlaSnapshot(created,'Urgente',illumination,DEFAULT_SLA_CONFIG,basePolicy()).firstResponseDueAt.toISOString()).toBe(at('2026-08-17','13:00').toISOString());
    expect(createSlaSnapshot(created,'Emergencial',illumination,DEFAULT_SLA_CONFIG,basePolicy()).firstResponseDueAt.toISOString()).toBe(at('2026-08-17','11:00').toISOString());
  });

  it('aplica SLA-base de 30 h, 160 h e multiplicadores sem reiniciar createdAt', () => {
    const created=at('2026-08-17','09:00');
    const limpeza=REFERENCE_CATEGORIES.find((item)=>item.id==='cat-limpeza')!;
    expect(createSlaSnapshot(created,'Normal',limpeza,DEFAULT_SLA_CONFIG,basePolicy()).resolutionTargetBusinessMinutes).toBe(30*60);
    expect(createSlaSnapshot(created,'Normal',structure,DEFAULT_SLA_CONFIG,basePolicy()).resolutionTargetBusinessMinutes).toBe(160*60);
    expect(createSlaSnapshot(created,'Urgente',illumination,DEFAULT_SLA_CONFIG,basePolicy()).resolutionTargetBusinessMinutes).toBe(36*60);
    expect(createSlaSnapshot(created,'Emergencial',illumination,DEFAULT_SLA_CONFIG,basePolicy()).resolutionTargetBusinessMinutes).toBe(24*60);
  });

  it('pausa e retoma acumulando apenas horas úteis, inclusive em múltiplas pausas', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00');
    let sla=createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,policy);
    const originalDue=sla.resolutionDueAt;
    sla=pauseSla(sla,at('2026-08-17','12:00'));
    expect(effectiveResolutionMinutes(created,at('2026-08-17','18:00'),sla,policy)).toBe(3*60);
    sla=resumeSla(sla,at('2026-08-17','18:00'),policy);
    expect(sla.accumulatedPausedBusinessMinutes).toBe(6*60);
    expect(sla.resolutionDueAt.getTime()).toBeGreaterThan(originalDue.getTime());
    sla=pauseSla(sla,at('2026-08-18','10:00'));
    sla=resumeSla(sla,at('2026-08-18','12:00'),policy);
    expect(sla.accumulatedPausedBusinessMinutes).toBe(8*60);
  });

  it('recalcula categoria/prioridade pelo tempo decorrido sem zerar o relógio e sem duplicar pausa em andamento', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00'); const now=at('2026-08-18','12:00');
    let sla=createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,policy);
    sla=pauseSla(sla,at('2026-08-18','10:00'));
    const changed=recalculateResolutionSla(sla,created,now,'Urgente',structure,DEFAULT_SLA_CONFIG,policy);
    expect(changed.resolutionTargetBusinessMinutes).toBe(Math.round(160*60*0.6));
    const resumed=resumeSla(changed,at('2026-08-18','13:00'),policy);
    expect(resumed.accumulatedPausedBusinessMinutes).toBe(3*60);
  });

  it('recalcula primeira resposta somente antes de ela ocorrer e preserva o resultado depois', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00');
    let sla=createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,policy);
    sla=recalculateFirstResponseBeforeResponse(sla,created,'Urgente',DEFAULT_SLA_CONFIG,policy);
    expect(sla.firstResponseTargetBusinessMinutes).toBe(4*60);
    sla=markFirstPublicResponse(sla,at('2026-08-17','12:00'));
    expect(sla.firstResponseOutcome).toBe('ON_TIME');
    const preserved=recalculateFirstResponseBeforeResponse(sla,created,'Baixa',DEFAULT_SLA_CONFIG,policy);
    expect(preserved.firstResponseTargetBusinessMinutes).toBe(4*60);
    expect(preserved.firstResponseOutcome).toBe('ON_TIME');
  });

  it('recalcula o resultado de conclusão quando categoria/prioridade são corrigidas explicitamente após o encerramento', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00');
    const limpeza=REFERENCE_CATEGORIES.find((item)=>item.id==='cat-limpeza')!;
    let sla=createSlaSnapshot(created,'Normal',limpeza,DEFAULT_SLA_CONFIG,policy);
    const closed=at('2026-08-20','19:00');
    sla=completeSla(sla,created,closed,policy);
    expect(sla.resolutionOutcome).toBe('BREACHED');
    const corrected=recalculateResolutionSla(sla,created,closed,'Normal',structure,DEFAULT_SLA_CONFIG,policy);
    expect(corrected.resolutionTargetBusinessMinutes).toBe(160*60);
    expect(corrected.resolutionOutcome).toBe('ON_TIME');
    expect(corrected.completedAt?.toISOString()).toBe(closed.toISOString());
  });

  it('não contabiliza como SLA efetivo o intervalo em que a ocorrência permaneceu encerrada antes de reabrir', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00');
    let sla=createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,policy);
    const originalDue=sla.resolutionDueAt;
    const closed=at('2026-08-17','12:00');
    sla=completeSla(sla,created,closed,policy);
    const reopened=at('2026-08-18','12:00');
    sla=reopenSla(sla,reopened,policy);
    expect(sla.accumulatedPausedBusinessMinutes).toBe(10*60);
    expect(sla.resolutionDueAt.getTime()).toBeGreaterThan(originalDue.getTime());
    expect(effectiveResolutionMinutes(created,reopened,sla,policy)).toBe(3*60);
    expect(sla.completedAt).toBeUndefined();
    expect(sla.resolutionOutcome).toBeUndefined();
  });

  it('diferencia tempo total e efetivo e encerra o SLA em estado terminal', () => {
    const policy=basePolicy(); const created=at('2026-08-17','09:00');
    let sla=createSlaSnapshot(created,'Normal',illumination,DEFAULT_SLA_CONFIG,policy);
    sla=pauseSla(sla,at('2026-08-17','12:00'));
    sla=resumeSla(sla,at('2026-08-17','18:00'),policy);
    const closed=at('2026-08-18','12:00');
    sla=completeSla(sla,created,closed,policy);
    expect((closed.getTime()-created.getTime())/3_600_000).toBeGreaterThan(effectiveResolutionMinutes(created,closed,sla,policy)/60);
    expect(calculateSlaFilterStatus('Resolvida',sla,closed)).toBe('COMPLETED');
    expect(sla.completedAt?.toISOString()).toBe(closed.toISOString());
  });

  it('usa exclusivamente o timezone IANA America/Sao_Paulo', () => {
    expect(DEFAULT_SERVICE_CALENDAR.timezone).toBe('America/Sao_Paulo');
    expect(at('2026-08-17','09:00').toISOString()).toBe('2026-08-17T12:00:00.000Z');
  });
});
