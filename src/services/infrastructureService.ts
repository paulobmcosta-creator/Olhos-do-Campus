import { z } from 'zod';
import type { InfrastructureCapacitySettings, InfrastructureOverview, InfrastructureSnapshot, StorageReconciliationReport } from '../models/infrastructure';
import { infrastructureOverviewResponseSchema, infrastructureSettingsResponseSchema, infrastructureSnapshotResponseSchema, storageReconciliationResponseSchema } from '../validators/responses';
import { requestJson } from './apiClient';

export const infrastructureService={
 overview:():Promise<InfrastructureOverview>=>requestJson('/api/admin/infrastructure',infrastructureOverviewResponseSchema,{authentication:'admin'}),
 snapshot:():Promise<InfrastructureSnapshot>=>requestJson('/api/admin/infrastructure/snapshot',infrastructureSnapshotResponseSchema,{method:'POST',authentication:'admin'}),
 estimateFirestore:(limit=5_000):Promise<InfrastructureSnapshot>=>requestJson('/api/admin/infrastructure/estimate-firestore',infrastructureSnapshotResponseSchema,{method:'POST',authentication:'admin',body:JSON.stringify({limit})}),
 reconcile:():Promise<StorageReconciliationReport>=>requestJson('/api/admin/infrastructure/reconcile-storage',storageReconciliationResponseSchema,{method:'POST',authentication:'admin'}),
 cleanup:(limit=20):Promise<{processed:number;failed:number}>=>requestJson('/api/admin/infrastructure/process-cleanup',z.object({processed:z.number(),failed:z.number()}),{method:'POST',authentication:'admin',body:JSON.stringify({limit})}),
 updateSettings:(settings:InfrastructureCapacitySettings):Promise<InfrastructureCapacitySettings>=>requestJson('/api/admin/infrastructure/settings',infrastructureSettingsResponseSchema,{method:'PUT',authentication:'admin',body:JSON.stringify({expectedVersion:settings.version,r2StorageReferenceBytes:settings.r2StorageReferenceBytes,firestoreStorageReferenceBytes:settings.firestoreStorageReferenceBytes,artifactRegistryStorageReferenceBytes:settings.artifactRegistryStorageReferenceBytes,resendDailyReference:settings.resendDailyReference,resendMonthlyReference:settings.resendMonthlyReference,warningPercent:settings.warningPercent,alertPercent:settings.alertPercent,criticalPercent:settings.criticalPercent,referenceVerifiedAt:settings.referenceVerifiedAt})}),
};
