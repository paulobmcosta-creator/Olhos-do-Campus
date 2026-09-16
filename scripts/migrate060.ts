import 'dotenv/config';
import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { createSlaSnapshot, completeSla, isSlaPaused, markFirstPublicResponse, pauseSla, reopenSla, resumeSla } from '../server/domain/sla';
import type { StoredOccurrenceSla } from '../server/models/occurrenceDomain';
import { FirestoreSlaConfigRepository } from '../server/repositories/slaConfigRepository';
import { REFERENCE_CATEGORIES } from '../server/repositories/referenceSeedData';
import { PRIORITY_RANK, type OccurrencePriority, type OccurrenceStatus } from '../src/models/occurrence';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
if (args.has('--dry-run') && apply) throw new Error('Use apenas --dry-run ou --apply.');
if (!SERVER_ENV.emulatorMode && apply && process.env.ALLOW_060_MIGRATION !== 'CONFIRM_MIGRATION_0_6') throw new Error('Migração fora do Emulator Suite bloqueada. Defina ALLOW_060_MIGRATION=CONFIRM_MIGRATION_0_6 somente após backup e conferência do projeto de destino.');

const { firestore } = getFirebaseAdminServices(SERVER_ENV);
const slaRepository = new FirestoreSlaConfigRepository(firestore);
const [slaConfig, calendar, exceptions] = await Promise.all([slaRepository.getSlaConfig(), slaRepository.getCalendar(), slaRepository.listExceptions()]);
const policy = { calendar, exceptions };
const categories = new Map(REFERENCE_CATEGORIES.map((item) => [item.id, item]));
const terminal = new Set<OccurrenceStatus>(['Resolvida', 'Não procedente', 'Duplicada', 'Cancelada']);

function toDate(value: unknown): Date | undefined { if (value instanceof Timestamp) return value.toDate(); if (value instanceof Date) return value; if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value); return undefined; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function tokens(...values: string[]): string[] { return [...new Set(values.flatMap((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('pt-BR').split(/[^a-z0-9]+/u).filter((part) => part.length >= 2)))].slice(0, 80); }
function eventDate(doc: QueryDocumentSnapshot<DocumentData>): Date | undefined { return toDate(doc.data().createdAt); }

async function reconstructSla(occurrenceId: string, data: DocumentData): Promise<{ sla?: StoredOccurrenceSla; firstPublicResponseAt?: Date; closedAt?: Date; reopenedCount: number; lastReopenedAt?: Date; assessment: 'CALCULATED' | 'ESTIMATED' | 'UNAVAILABLE' }> {
  const createdAt = toDate(data.createdAt); const category = categories.get(String(data.categoryId ?? '')); const priority = String(data.priority ?? 'Normal') as OccurrencePriority;
  if (!createdAt || !category || !(priority in PRIORITY_RANK)) return { reopenedCount: Number(data.reopenedCount ?? 0), assessment: 'UNAVAILABLE' };
  let sla = createSlaSnapshot(createdAt, priority, category, slaConfig, policy); sla.legacyAssessment = 'ESTIMATED';
  const eventSnap = await firestore.collection('occurrences').doc(occurrenceId).collection('events').orderBy('createdAt', 'asc').get();
  let priorStatus: OccurrenceStatus = 'Recebida'; let firstPublicResponseAt = toDate(data.firstPublicResponseAt); let closedAt = toDate(data.closedAt);
  let reopenedCount = Number(data.reopenedCount ?? 0); let lastReopenedAt = toDate(data.lastReopenedAt); let evidence = 0;
  for (const event of eventSnap.docs) {
    const item = event.data(); const at = eventDate(event); if (!at) continue;
    const eventType = String(item.eventType ?? ''); const nextValue = typeof item.newValue === 'string' ? item.newValue as OccurrenceStatus : undefined;
    const changesStatus = eventType === 'STATUS_CHANGED' || eventType === 'OCCURRENCE_RESOLVED' || eventType === 'OCCURRENCE_REOPENED' || eventType === 'OCCURRENCE_CLOSED';
    if (!firstPublicResponseAt && changesStatus && item.visibility === 'PUBLIC') { firstPublicResponseAt = at; sla = markFirstPublicResponse(sla, at); evidence += 1; }
    if (eventType === 'OCCURRENCE_REOPENED') { reopenedCount += data.reopenedCount === undefined ? 1 : 0; lastReopenedAt = at; sla = reopenSla(sla, at, policy); evidence += 1; }
    if (changesStatus && nextValue) {
      if (!isSlaPaused(priorStatus) && isSlaPaused(nextValue)) { sla = pauseSla(sla, at); evidence += 1; }
      if (isSlaPaused(priorStatus) && !isSlaPaused(nextValue)) { sla = resumeSla(sla, at, policy); evidence += 1; }
      if (terminal.has(nextValue)) { if (sla.resolutionPaused) sla = resumeSla(sla, at, policy); sla = completeSla(sla, createdAt, at, policy); closedAt = at; evidence += 1; }
      priorStatus = nextValue;
    }
  }
  if (firstPublicResponseAt && !sla.firstResponseAt) sla = markFirstPublicResponse(sla, firstPublicResponseAt);
  const currentStatus = String(data.status ?? 'Recebida') as OccurrenceStatus;
  if (currentStatus === 'Resolvida' && !closedAt) { const resolvedAt = toDate(data.resolvedAt); if (resolvedAt) { closedAt = resolvedAt; sla = completeSla(sla, createdAt, resolvedAt, policy); evidence += 1; } }
  if (isSlaPaused(currentStatus) && !sla.resolutionPaused) { sla = { ...sla, resolutionPaused: true, legacyAssessment: 'UNAVAILABLE' }; }
  sla.legacyAssessment = sla.legacyAssessment === 'UNAVAILABLE' ? 'UNAVAILABLE' : evidence > 0 ? 'CALCULATED' : 'ESTIMATED';
  return { sla, ...(firstPublicResponseAt ? { firstPublicResponseAt } : {}), ...(closedAt ? { closedAt } : {}), reopenedCount, ...(lastReopenedAt ? { lastReopenedAt } : {}), assessment: sla.legacyAssessment };
}

const adminSnapshot = await firestore.collection('adminUsers').get();
const legacyAdmins = adminSnapshot.docs.filter((doc) => doc.data().role === 'Atendente');
const departments = adminSnapshot.docs.filter((doc) => { const dept = doc.data().department as unknown; return typeof dept === 'string' && dept.trim() !== ''; });
const occurrenceSnapshot = await firestore.collection('occurrences').get();
let occurrenceUpdates = 0; let calculated = 0; let estimated = 0; let unavailable = 0;
const pending: Array<{ ref: QueryDocumentSnapshot<DocumentData>['ref']; patch: DocumentData }> = [];
for (const doc of occurrenceSnapshot.docs) {
  const data = doc.data(); const categoryId = String(data.categoryId ?? ''); const categoryName = String(data.categoryNameSnapshot ?? ''); const location = data.location as DocumentData | undefined;
  const priority = String(data.priority ?? 'Normal') as OccurrencePriority; const status = String(data.status ?? 'Recebida') as OccurrenceStatus;
  const photos = data.hasPhoto === undefined ? await doc.ref.collection('photos').where('status', '==', 'READY').limit(1).get() : undefined;
  const reconstructed = data.sla ? { assessment: 'CALCULATED' as const, reopenedCount: Number(data.reopenedCount ?? 0), ...(toDate(data.lastReopenedAt) ? { lastReopenedAt: toDate(data.lastReopenedAt) } : {}) } : await reconstructSla(doc.id, data);
  if (reconstructed.assessment === 'CALCULATED') calculated += 1; else if (reconstructed.assessment === 'ESTIMATED') estimated += 1; else unavailable += 1;
  const patch: DocumentData = {
    schemaVersion: 2,
    reportedCategoryId: (data.reportedCategoryId as string | undefined) ?? categoryId,
    reportedCategoryNameSnapshot: (data.reportedCategoryNameSnapshot as string | undefined) ?? categoryName,
    reportedLocation: (data.reportedLocation as DocumentData | undefined) ?? location,
    priorityRank: PRIORITY_RANK[priority] ?? 4,
    dataClassification: data.dataClassification === 'TEST' ? 'TEST' : 'REAL',
    reopenedCount: reconstructed.reopenedCount,
    hasTeam: typeof data.assignedTeamId === 'string' && data.assignedTeamId !== '',
    hasResponsible: typeof data.assignedToAdminUserId === 'string' && data.assignedToAdminUserId !== '',
    hasPhoto: (data.hasPhoto as boolean | undefined) ?? !photos?.empty,
    isClosed: terminal.has(status),
    reopened: reconstructed.reopenedCount > 0,
    ...(data.lastReopenedAt ? {} : reconstructed.lastReopenedAt ? { lastReopenedAt: Timestamp.fromDate(reconstructed.lastReopenedAt) } : {}),
    searchTokens: strings(data.searchTokens).length ? strings(data.searchTokens) : tokens(String(data.description ?? ''), categoryName, String(location?.buildingName ?? ''), String(location?.room ?? '')),
    ...(data.sla ? {} : reconstructed.sla ? { sla: reconstructed.sla } : {}),
    ...(data.firstPublicResponseAt ? {} : reconstructed.firstPublicResponseAt ? { firstPublicResponseAt: Timestamp.fromDate(reconstructed.firstPublicResponseAt) } : {}),
    ...(data.closedAt ? {} : reconstructed.closedAt ? { closedAt: Timestamp.fromDate(reconstructed.closedAt) } : {}),
  };
  pending.push({ ref: doc.ref, patch }); occurrenceUpdates += 1;
}

console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', project: SERVER_ENV.firebaseProjectId, database: SERVER_ENV.firestoreDatabaseId, adminUsers: adminSnapshot.size, legacyAtendente: legacyAdmins.length, departmentLegacyNotAutoMapped: departments.length, occurrences: occurrenceSnapshot.size, occurrenceUpdates, slaLegacy: { calculated, estimated, unavailable } }, null, 2));
if (legacyAdmins.length) console.log('Usuários Atendente detectados (nenhuma promoção automática):', legacyAdmins.map((doc) => doc.id).join(', '));
if (!apply) { console.log('Dry-run concluído. Nenhuma escrita realizada. Faça backup/exportação e execute com --apply somente após revisar este relatório.'); process.exit(0); }

for (const adminDoc of adminSnapshot.docs) {
  const data = adminDoc.data(); const patch: DocumentData = {};
  if (!Array.isArray(data.teamIds)) patch.teamIds = [];
  if (Object.keys(patch).length) await adminDoc.ref.set(patch, { merge: true });
}
for (let index = 0; index < pending.length; index += 350) {
  const batch = firestore.batch(); for (const item of pending.slice(index, index + 350)) batch.set(item.ref, item.patch, { merge: true }); await batch.commit();
}
console.log('Migração 0.5.1 → 0.6.0 aplicada. Papéis Atendente e campos department permaneceram sem conversão automática; use a interface administrativa para decisões explícitas.');
