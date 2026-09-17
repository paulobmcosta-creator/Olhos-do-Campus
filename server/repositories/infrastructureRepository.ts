import type { DocumentData, Firestore, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { InfrastructureCapacitySettings, InfrastructureSnapshot, NotificationFailureCategory } from '../../src/models/infrastructure';

export const DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS: InfrastructureCapacitySettings = {
  schemaVersion: 1,
  r2StorageReferenceBytes: 10_000_000_000,
  firestoreStorageReferenceBytes: 1_073_741_824,
  artifactRegistryStorageReferenceBytes: 536_870_912,
  resendDailyReference: 100,
  resendMonthlyReference: 3_000,
  warningPercent: 70,
  alertPercent: 85,
  criticalPercent: 95,
  referenceVerifiedAt: '2026-08-18',
  version: 1,
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'seed-0.7.0',
};

function iso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

function nullableIso(value: unknown): string | null { return value === null || value === undefined ? null : iso(value); }
function nullableNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function stringOr(value: unknown, fallback: string): string { return typeof value === 'string' ? value : fallback; }
function notificationFailureCategory(value: unknown): NotificationFailureCategory | null {
  const allowed: NotificationFailureCategory[] = ['TRANSIENT','QUOTA','CONFIGURATION','INVALID_RECIPIENT','SUPPRESSION','BOUNCE','COMPLAINT','UNKNOWN'];
  return allowed.includes(value as NotificationFailureCategory) ? value as NotificationFailureCategory : null;
}

function settingsFromData(data: DocumentData): InfrastructureCapacitySettings {
  return {
    schemaVersion: 1,
    r2StorageReferenceBytes: Number(data.r2StorageReferenceBytes ?? DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS.r2StorageReferenceBytes),
    firestoreStorageReferenceBytes: Number(data.firestoreStorageReferenceBytes ?? DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS.firestoreStorageReferenceBytes),
    artifactRegistryStorageReferenceBytes: Number(data.artifactRegistryStorageReferenceBytes ?? DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS.artifactRegistryStorageReferenceBytes),
    resendDailyReference: Number(data.resendDailyReference ?? DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS.resendDailyReference),
    resendMonthlyReference: Number(data.resendMonthlyReference ?? DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS.resendMonthlyReference),
    warningPercent: Number(data.warningPercent ?? 70), alertPercent: Number(data.alertPercent ?? 85), criticalPercent: Number(data.criticalPercent ?? 95),
    referenceVerifiedAt: String(data.referenceVerifiedAt ?? '2026-08-18'), version: Number(data.version ?? 1),
    updatedAt: iso(data.updatedAt), updatedBy: String(data.updatedBy ?? 'seed-0.7.0'),
  };
}

function snapshotFromData(id: string, data: DocumentData): InfrastructureSnapshot {
  const r2 = data.r2 as Record<string, unknown> | undefined;
  const firestore = data.firestore as Record<string, unknown> | undefined;
  const notifications = data.notifications as Record<string, unknown> | undefined;
  const cleanup = data.cleanup as Record<string, unknown> | undefined;
  const artifact = data.artifactRegistry as Record<string, unknown> | undefined;
  const reconciliation = data.reconciliation as Record<string, unknown> | undefined;
  return {
    id, schemaVersion: 1, capturedAt: iso(data.capturedAt),
    captureSource: data.captureSource === 'MAINTENANCE_WORKER' ? 'MAINTENANCE_WORKER' : data.captureSource === 'ARTIFACT_SCRIPT' ? 'ARTIFACT_SCRIPT' : 'ADMIN',
    period: String(data.period ?? ''),
    r2: { measured:r2?.measured===true,inventoryComplete:r2?.inventoryComplete===true,objectCount:nullableNumber(r2?.objectCount),bytes:nullableNumber(r2?.bytes),mainPhotoCount:nullableNumber(r2?.mainPhotoCount),thumbnailCount:nullableNumber(r2?.thumbnailCount),oldestObjectAt:nullableIso(r2?.oldestObjectAt),lastInventoryAt:nullableIso(r2?.lastInventoryAt) },
    firestore: { counts:(firestore?.counts??{}) as Record<string,number>,totalDocuments:Number(firestore?.totalDocuments??0),estimatedLogicalBytes:nullableNumber(firestore?.estimatedLogicalBytes),estimationMethod:stringOr(firestore?.estimationMethod,'Não medido'),documentsSampled:Number(firestore?.documentsSampled??0),coveragePercent:nullableNumber(firestore?.coveragePercent) },
    notifications: { sentToday:Number(notifications?.sentToday??0),sentThisMonth:Number(notifications?.sentThisMonth??0),acceptedToday:Number(notifications?.acceptedToday??notifications?.sentToday??0),acceptedThisMonth:Number(notifications?.acceptedThisMonth??notifications?.sentThisMonth??0),acceptedTotal:Number(notifications?.acceptedTotal??0),attemptsStarted:Number(notifications?.attemptsStarted??0),attemptsAccepted:Number(notifications?.attemptsAccepted??notifications?.acceptedTotal??0),attemptsDelivered:Number(notifications?.attemptsDelivered??0),attemptsFailed:Number(notifications?.attemptsFailed??0),attemptsBounced:Number(notifications?.attemptsBounced??0),attemptsComplained:Number(notifications?.attemptsComplained??0),attemptsUncertain:Number(notifications?.attemptsUncertain??0),retries:Number(notifications?.retries??0),pending:Number(notifications?.pending??0),retryPending:Number(notifications?.retryPending??0),deliveryUncertain:Number(notifications?.deliveryUncertain??0),failed:Number(notifications?.failed??0),failedConfiguration:Number(notifications?.failedConfiguration??0),delivered:Number(notifications?.delivered??0),bounced:Number(notifications?.bounced??0),complained:Number(notifications?.complained??0),unmatchedWebhookPending:Number(notifications?.unmatchedWebhookPending??0),oldestPendingAt:nullableIso(notifications?.oldestPendingAt),oldestUnmatchedWebhookAt:nullableIso(notifications?.oldestUnmatchedWebhookAt),lastAttemptAt:nullableIso(notifications?.lastAttemptAt),lastSuccessfulSendAt:nullableIso(notifications?.lastSuccessfulSendAt),lastError:typeof notifications?.lastError==='string'?notifications.lastError:null,lastFailureCategory:notificationFailureCategory(notifications?.lastFailureCategory) },
    cleanup: { pendingTasks:Number(cleanup?.pendingTasks??0),completedTasks:Number(cleanup?.completedTasks??0),pendingObjects:Number(cleanup?.pendingObjects??0),oldestPendingAt:nullableIso(cleanup?.oldestPendingAt),lastError:typeof cleanup?.lastError==='string'?cleanup.lastError:null },
    artifactRegistry: { collected:artifact?.collected===true,capturedAt:nullableIso(artifact?.capturedAt),bytes:nullableNumber(artifact?.bytes),versionCount:nullableNumber(artifact?.versionCount),repository:typeof artifact?.repository==='string'?artifact.repository:null },
    reconciliation: { missingObjects:Number(reconciliation?.missingObjects??0),orphanObjects:Number(reconciliation?.orphanObjects??0),sizeMismatches:Number(reconciliation?.sizeMismatches??0),lastRunAt:nullableIso(reconciliation?.lastRunAt) },
  };
}

function timestampOrNull(value: string | null): Timestamp | null { return value === null ? null : Timestamp.fromDate(new Date(value)); }
function snapshotToData(snapshot: InfrastructureSnapshot): DocumentData {
  return {
    ...snapshot,
    capturedAt: Timestamp.fromDate(new Date(snapshot.capturedAt)),
    r2: { ...snapshot.r2, oldestObjectAt: timestampOrNull(snapshot.r2.oldestObjectAt), lastInventoryAt: timestampOrNull(snapshot.r2.lastInventoryAt) },
    notifications: { ...snapshot.notifications, oldestPendingAt: timestampOrNull(snapshot.notifications.oldestPendingAt), oldestUnmatchedWebhookAt: timestampOrNull(snapshot.notifications.oldestUnmatchedWebhookAt), lastAttemptAt: timestampOrNull(snapshot.notifications.lastAttemptAt), lastSuccessfulSendAt: timestampOrNull(snapshot.notifications.lastSuccessfulSendAt) },
    cleanup: { ...snapshot.cleanup, oldestPendingAt: timestampOrNull(snapshot.cleanup.oldestPendingAt) },
    artifactRegistry: { ...snapshot.artifactRegistry, capturedAt: timestampOrNull(snapshot.artifactRegistry.capturedAt) },
    reconciliation: { ...snapshot.reconciliation, lastRunAt: timestampOrNull(snapshot.reconciliation.lastRunAt) },
  };
}

export function shouldDeleteTechnicalDailySnapshot(id:string,capturedAt:Date,now:Date,monthlyAggregateExists:boolean):boolean{
  return id.startsWith('daily-')&&monthlyAggregateExists&&capturedAt.getTime()<now.getTime()-400*24*60*60_000;
}

export interface ArtifactRegistryObservation { capturedAt: string; bytes: number; versionCount: number; repository: string; }
export interface ReconciliationObservation { missingObjects: number; orphanObjects: number; sizeMismatches: number; lastRunAt: string; }
export interface FirestoreLogicalEstimate {
  estimatedLogicalBytes: number | null;
  estimationMethod: string;
  documentsSampled: number;
  coveragePercent: number | null;
}

export interface InfrastructureRepository {
  getSettings(): Promise<InfrastructureCapacitySettings>;
  updateSettings(input: Omit<InfrastructureCapacitySettings,'schemaVersion'|'version'|'updatedAt'|'updatedBy'>, expectedVersion: number, actorId: string): Promise<InfrastructureCapacitySettings>;
  saveSnapshot(snapshot: InfrastructureSnapshot): Promise<void>;
  history(limit?: number): Promise<InfrastructureSnapshot[]>;
  latest(): Promise<InfrastructureSnapshot | null>;
  latestArtifactObservation(): Promise<ArtifactRegistryObservation | undefined>;
  saveReconciliationObservation(value: ReconciliationObservation): Promise<void>;
  latestReconciliationObservation(): Promise<ReconciliationObservation | undefined>;
  collectionCounts(): Promise<Record<string, number>>;
  estimateFirestoreLogicalBytes(limit: number): Promise<FirestoreLogicalEstimate>;
  cleanupTechnicalSnapshots(now: Date): Promise<number>;
}

export class FirestoreInfrastructureRepository implements InfrastructureRepository {
  private readonly settingsReference;
  private readonly snapshots;
  public constructor(private readonly firestore: Firestore) {
    this.settingsReference = firestore.doc('infrastructureCapacitySettings/default');
    this.snapshots = firestore.collection('infrastructureUsageSnapshots');
  }

  private collectionSpecs(): Array<[string, Query<DocumentData>]> {
    return [
      ['occurrences',this.firestore.collection('occurrences')],['events',this.firestore.collectionGroup('events')],['photosMetadata',this.firestore.collectionGroup('photos')],
      ['adminUsers',this.firestore.collection('adminUsers')],['categories',this.firestore.collection('categories')],['locations',this.firestore.collection('locations')],
      ['operationalTeams',this.firestore.collection('operationalTeams')],['systemSettings',this.firestore.collection('systemSettings')],['serviceCalendars',this.firestore.collection('serviceCalendars')],
      ['serviceCalendarExceptions',this.firestore.collection('serviceCalendarExceptions')],['auditLogs',this.firestore.collection('auditLogs')],['protocolCounters',this.firestore.collection('protocolCounters')],
      ['storageCleanupTasks',this.firestore.collection('storageCleanupTasks')],['notificationOutbox',this.firestore.collection('notificationOutbox')],['notificationDeliveryAttempts',this.firestore.collectionGroup('attempts')],['notificationWebhookEvents',this.firestore.collection('notificationWebhookEvents')],['infrastructureUsageSnapshots',this.snapshots],
    ];
  }

  public async getSettings(): Promise<InfrastructureCapacitySettings> { const snapshot=await this.settingsReference.get();return snapshot.exists?settingsFromData(snapshot.data()??{}):structuredClone(DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS); }
  public async updateSettings(input:Omit<InfrastructureCapacitySettings,'schemaVersion'|'version'|'updatedAt'|'updatedBy'>,expectedVersion:number,actorId:string):Promise<InfrastructureCapacitySettings>{return this.firestore.runTransaction(async tx=>{const currentSnapshot=await tx.get(this.settingsReference);const current=currentSnapshot.exists?settingsFromData(currentSnapshot.data()??{}):structuredClone(DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS);if(current.version!==expectedVersion)throw new Error('INFRASTRUCTURE_SETTINGS_CONFLICT');const next:InfrastructureCapacitySettings={schemaVersion:1,...input,version:current.version+1,updatedAt:new Date().toISOString(),updatedBy:actorId};tx.set(this.settingsReference,{...next,updatedAt:Timestamp.now()});return next;});}
  public async saveSnapshot(snapshot:InfrastructureSnapshot):Promise<void>{await this.snapshots.doc(snapshot.id).set(snapshotToData(snapshot));const monthlyId=`monthly-${snapshot.period.slice(0,7)}`;await this.snapshots.doc(monthlyId).set(snapshotToData({...snapshot,id:monthlyId}));}
  public async history(limit=365):Promise<InfrastructureSnapshot[]>{const result=await this.snapshots.where('period','>=','0000').orderBy('period','desc').limit(Math.min(Math.max(limit,1),500)).get();return result.docs.filter(doc=>doc.id.startsWith('daily-')).map(doc=>snapshotFromData(doc.id,doc.data()));}
  public async latest():Promise<InfrastructureSnapshot|null>{return (await this.history(1))[0]??null;}
  public async latestArtifactObservation():Promise<ArtifactRegistryObservation|undefined>{const snapshot=await this.firestore.collection('artifactRegistrySnapshots').orderBy('capturedAt','desc').limit(1).get();const doc=snapshot.docs[0];if(doc===undefined)return undefined;const data=doc.data();return{capturedAt:iso(data.capturedAt),bytes:Number(data.bytes??0),versionCount:Number(data.versionCount??0),repository:String(data.repository??'')};}
  public async saveReconciliationObservation(value:ReconciliationObservation):Promise<void>{await this.firestore.doc('storageReconciliationReports/latest').set({...value,lastRunAt:Timestamp.fromDate(new Date(value.lastRunAt)),schemaVersion:1});}
  public async latestReconciliationObservation():Promise<ReconciliationObservation|undefined>{const snapshot=await this.firestore.doc('storageReconciliationReports/latest').get();if(!snapshot.exists)return undefined;const data=snapshot.data()??{};return{missingObjects:Number(data.missingObjects??0),orphanObjects:Number(data.orphanObjects??0),sizeMismatches:Number(data.sizeMismatches??0),lastRunAt:iso(data.lastRunAt)};}
  public async collectionCounts():Promise<Record<string,number>>{const values=await Promise.all(this.collectionSpecs().map(async([name,query])=>[name,(await query.count().get()).data().count] as const));return Object.fromEntries(values);}
  public async estimateFirestoreLogicalBytes(limit:number):Promise<FirestoreLogicalEstimate>{const maximum=Math.min(Math.max(Math.trunc(limit),100),10_000);const specs=this.collectionSpecs();const allocation=Math.max(1,Math.floor(maximum/specs.length));let totalDocuments=0,documentsSampled=0,estimatedLogicalBytes=0;for(const[,base]of specs){const count=(await base.count().get()).data().count;totalDocuments+=count;if(count===0)continue;let sampled=0,sampleBytes=0,cursor:QueryDocumentSnapshot|undefined;while(sampled<Math.min(count,allocation)){let pageQuery:Query<DocumentData>=base.limit(Math.min(250,allocation-sampled));if(cursor!==undefined)pageQuery=pageQuery.startAfter(cursor);const page=await pageQuery.get();if(page.empty)break;for(const document of page.docs){sampleBytes+=Buffer.byteLength(document.ref.path,'utf8')+Buffer.byteLength(JSON.stringify(document.data()),'utf8');sampled+=1;}cursor=page.docs.at(-1);if(page.size<Math.min(250,allocation-sampled+page.size))break;}documentsSampled+=sampled;if(sampled>0)estimatedLogicalBytes+=Math.round((sampleBytes/sampled)*count);}return{estimatedLogicalBytes:documentsSampled===0?null:estimatedLogicalBytes,estimationMethod:documentsSampled===0?'Estimativa indisponível: nenhuma amostra foi coletada.':`Estimativa lógica por amostragem paginada de ${documentsSampled}/${totalDocuments} documentos em ${new Date().toISOString()}; soma aproximada de path + JSON, sem índices ou overhead faturável.`,documentsSampled,coveragePercent:totalDocuments===0?null:(documentsSampled/totalDocuments)*100};}
  public async cleanupTechnicalSnapshots(now:Date):Promise<number>{const cutoff=new Date(now.getTime()-400*24*60*60_000);const old=await this.snapshots.where('capturedAt','<',Timestamp.fromDate(cutoff)).limit(50).get();let removed=0;for(const doc of old.docs){const month=doc.id.slice(6,13);const monthlyExists=(await this.snapshots.doc(`monthly-${month}`).get()).exists;const data=doc.data();const capturedAt=data.capturedAt instanceof Timestamp?data.capturedAt.toDate():new Date(0);if(shouldDeleteTechnicalDailySnapshot(doc.id,capturedAt,now,monthlyExists)){await doc.ref.delete();removed+=1;}}return removed;}
}
