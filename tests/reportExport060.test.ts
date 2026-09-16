import { describe, expect, it } from 'vitest';
import { createCsv, createPdf, createXlsx, EXPORT_HEADERS, EXPORT_LIMIT } from '../server/utils/reportExport';
import { makeOccurrenceServiceFixture, createInput } from './helpers/occurrenceServiceFixture';

describe('exportações operacionais 0.6.0',()=>{
  it('gera CSV UTF-8 com campos operacionais e sem dados de segurança',async()=>{
    const {service,occurrences}=makeOccurrenceServiceFixture();
    const created=await service.create(createInput,'export-csv');
    const stored=await occurrences.findByProtocol(created.protocol);
    const text=createCsv([stored!]).toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Protocolo;Data de abertura');
    expect(text).toContain('Iluminação');
    for(const forbidden of ['trackingKeyHash','trackingKeySalt','storagePath','checksum','internalNote','Authorization'])expect(text).not.toContain(forbidden);
  });
  it('gera XLSX como contêiner ZIP e PDF com assinatura válida',async()=>{
    const {service,occurrences}=makeOccurrenceServiceFixture();const created=await service.create(createInput,'export-binary');const stored=await occurrences.findByProtocol(created.protocol);
    const xlsx=createXlsx([stored!]);const pdf=createPdf([stored!]);
    expect(xlsx.subarray(0,2).toString('ascii')).toBe('PK');
    expect(xlsx.toString('utf8')).not.toContain('trackingKeyHash');
    expect(pdf.subarray(0,8).toString('latin1')).toContain('%PDF-1.4');
    expect(pdf.toString('latin1')).not.toContain('trackingKeyHash');
  });
  it('mantém limite seguro e colunas de SLA explicitamente documentadas',()=>{
    expect(EXPORT_LIMIT).toBe(2000);
    expect(EXPORT_HEADERS).toEqual(expect.arrayContaining(['Prazo primeira resposta','Primeira resposta','Resultado primeira resposta','SLA conclusão alvo (h úteis)','Tempo total (h corridas)','Tempo efetivo (h úteis)','Pausa atual']));
  });
});
