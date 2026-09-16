import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { AdminRole, AuditEventType, AuditLog, AuditLogFilters, AuditTargetType } from '../../src/models/admin';
import { zonedLocalToDate } from '../domain/businessTime';

export type NewAuditLog=Omit<AuditLog,'id'|'timestamp'>;
function iso(v:unknown):string{if(v instanceof Timestamp)return v.toDate().toISOString();if(typeof v==='string')return v;return new Date(0).toISOString();}
function fromDoc(id:string,d:DocumentData):AuditLog{return{id,eventType:d.eventType as AuditEventType,...(typeof d.actorUid==='string'?{actorUid:d.actorUid}:{}),...(typeof d.actorEmail==='string'?{actorEmail:d.actorEmail}:{}),...(typeof d.actorRole==='string'?{actorRole:d.actorRole as AdminRole}:{}),targetType:d.targetType as AuditTargetType,...(typeof d.targetId==='string'?{targetId:d.targetId}:{}),timestamp:iso(d.timestamp),summary:String(d.summary??''),...(typeof d.requestCorrelationId==='string'?{requestCorrelationId:d.requestCorrelationId}:{}),...(d.metadata&&typeof d.metadata==='object'?{metadata:d.metadata as Record<string,string|number|boolean>}:{})};}
function encode(date:string,id:string):string{return Buffer.from(JSON.stringify({date,id}),'utf8').toString('base64url');}
function decode(value:string):{date:string;id:string}{const p=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as {date:string;id:string};return p;}
export interface AuditLogRepository{write(input:NewAuditLog):Promise<void>;list(limit:number):Promise<AuditLog[]>;page(filters:AuditLogFilters):Promise<{items:AuditLog[];limit:number;hasMore:boolean;nextCursor?:string}>;}
export class FirestoreAuditLogRepository implements AuditLogRepository{
 private readonly collection;public constructor(firestore:Firestore){this.collection=firestore.collection('auditLogs');}
 public async write(input:NewAuditLog):Promise<void>{await this.collection.add({...input,timestamp:FieldValue.serverTimestamp()});}
 public async list(limit:number):Promise<AuditLog[]>{const s=await this.collection.orderBy('timestamp','desc').limit(limit).get();return s.docs.map(d=>fromDoc(d.id,d.data()));}
 public async page(filters:AuditLogFilters):Promise<{items:AuditLog[];limit:number;hasMore:boolean;nextCursor?:string}>{let q:Query<DocumentData>=this.collection;if(filters.eventType)q=q.where('eventType','==',filters.eventType);if(filters.targetType)q=q.where('targetType','==',filters.targetType);if(filters.targetId)q=q.where('targetId','==',filters.targetId);if(filters.occurrenceId)q=q.where('targetId','==',filters.occurrenceId);if(filters.actor)q=q.where('actorEmail','==',filters.actor.toLowerCase());if(filters.startDate)q=q.where('timestamp','>=',Timestamp.fromDate(zonedLocalToDate(filters.startDate,'00:00','America/Sao_Paulo')));if(filters.endDate)q=q.where('timestamp','<=',Timestamp.fromDate(new Date(zonedLocalToDate(filters.endDate,'23:59','America/Sao_Paulo').getTime()+59_999)));q=q.orderBy('timestamp','desc').orderBy('__name__','desc');if(filters.cursor){const c=decode(filters.cursor);q=q.startAfter(Timestamp.fromDate(new Date(c.date)),this.collection.doc(c.id));}const limit=filters.limit??25;const s=await q.limit(limit+1).get();const docs=s.docs.slice(0,limit);const items=docs.map(d=>fromDoc(d.id,d.data()));const last=items.at(-1);return{items,limit,hasMore:s.size>limit,...(s.size>limit&&last?{nextCursor:encode(last.timestamp,last.id)}:{})};}
}

/** Repositório em memória destinado exclusivamente aos testes automatizados. */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly events: AuditLog[] = [];
  public async write(input: NewAuditLog): Promise<void> {
    await Promise.resolve();
    this.events.unshift({ ...structuredClone(input), id: `audit-${this.events.length + 1}`, timestamp: new Date().toISOString() });
  }
  public async list(limit: number): Promise<AuditLog[]> {
    await Promise.resolve();
    return this.events.slice(0, limit).map((event) => structuredClone(event));
  }
  public async page(filters: AuditLogFilters): Promise<{items:AuditLog[];limit:number;hasMore:boolean;nextCursor?:string}> {
    await Promise.resolve();
    const limit = filters.limit ?? 25;
    const start = filters.cursor ? Number(Buffer.from(filters.cursor, 'base64url').toString('utf8')) : 0;
    const filtered = this.events.filter((event) => {
      if (filters.eventType && event.eventType !== filters.eventType) return false;
      if (filters.targetType && event.targetType !== filters.targetType) return false;
      if (filters.targetId && event.targetId !== filters.targetId) return false;
      if (filters.occurrenceId && event.targetId !== filters.occurrenceId) return false;
      if (filters.actor && event.actorEmail?.toLowerCase() !== filters.actor.toLowerCase()) return false;
      if (filters.startDate && event.timestamp.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate && event.timestamp.slice(0, 10) > filters.endDate) return false;
      return true;
    });
    const items = filtered.slice(start, start + limit).map((event) => structuredClone(event));
    const next = start + items.length;
    return { items, limit, hasMore: next < filtered.length, ...(next < filtered.length ? { nextCursor: Buffer.from(String(next), 'utf8').toString('base64url') } : {}) };
  }
}
