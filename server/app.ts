import express from 'express';
import type { Express } from 'express';
import type { FirebaseAdminServices } from './config/firebaseAdmin';
import { getFirebaseAdminServices } from './config/firebaseAdmin';
import type { ServerEnvironment } from './config/env';
import { assignCorrelationId } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { FirestoreAdminUserRepository } from './repositories/adminUserRepository';
import type { AdminUserRepository } from './repositories/adminUserRepository';
import { FirestoreAuditLogRepository } from './repositories/auditLogRepository';
import type { AuditLogRepository } from './repositories/auditLogRepository';
import { FirestoreCategoryRepository } from './repositories/categoryRepository';
import type { CategoryRepository } from './repositories/categoryRepository';
import { CloudStoragePhotoRepository } from './repositories/cloudStoragePhotoRepository';
import { FirestoreLocationRepository } from './repositories/locationRepository';
import type { LocationRepository } from './repositories/locationRepository';
import { FirestoreOccurrenceEventRepository } from './repositories/occurrenceEventRepository';
import type { OccurrenceEventRepository } from './repositories/occurrenceEventRepository';
import { FirestoreOccurrenceRepository } from './repositories/occurrenceRepository';
import type { OccurrenceRepository } from './repositories/occurrenceRepository';
import { FirestoreOperationalTeamRepository } from './repositories/operationalTeamRepository';
import type { OperationalTeamRepository } from './repositories/operationalTeamRepository';
import { FirestoreSlaConfigRepository } from './repositories/slaConfigRepository';
import type { SlaConfigRepository } from './repositories/slaConfigRepository';
import { FirestorePhotoMetadataRepository } from './repositories/photoMetadataRepository';
import type { PhotoMetadataRepository } from './repositories/photoMetadataRepository';
import type { PhotoRepository } from './repositories/photoRepository';
import { FirestoreStorageCleanupTaskRepository } from './repositories/storageCleanupTaskRepository';
import type { StorageCleanupTaskRepository } from './repositories/storageCleanupTaskRepository';
import { FirestoreSystemConfigRepository } from './repositories/systemConfigRepository';
import type { SystemConfigRepository } from './repositories/systemConfigRepository';
import { createApiRouter } from './routes/apiRoutes';
import { AdminAuthorizationService } from './services/adminAuthorizationService';
import { AdminUserService } from './services/adminUserService';
import { AppCheckTokenService } from './services/appCheckTokenService';
import { ConfigService } from './services/configService';
import { FirebaseTokenService } from './services/firebaseTokenService';
import { ImageProcessingService } from './services/imageProcessingService';
import { OccurrenceService } from './services/occurrenceService';
import { PhotoService } from './services/photoService';
import { OperationalAdminService } from './services/operationalAdminService';
import type { AppCheckVerifier, FirebaseTokenVerifier } from './types/firebase';

export interface CreateAppOptions {
  environment: ServerEnvironment;
  firebase?: FirebaseAdminServices;
  tokenVerifier?: FirebaseTokenVerifier;
  appCheckVerifier?: AppCheckVerifier;
  adminUserRepository?: AdminUserRepository;
  auditLogRepository?: AuditLogRepository;
  occurrenceRepository?: OccurrenceRepository;
  occurrenceEventRepository?: OccurrenceEventRepository;
  categoryRepository?: CategoryRepository;
  locationRepository?: LocationRepository;
  systemConfigRepository?: SystemConfigRepository;
  operationalTeamRepository?: OperationalTeamRepository;
  slaConfigRepository?: SlaConfigRepository;
  photoObjectRepository?: PhotoRepository;
  photoMetadataRepository?: PhotoMetadataRepository;
  storageCleanupTaskRepository?: StorageCleanupTaskRepository;
  photoService?: PhotoService;
}

export function createApp(options: CreateAppOptions): Express {
  const { environment } = options;
  const needsFirebase = options.tokenVerifier === undefined
    || options.appCheckVerifier === undefined
    || options.adminUserRepository === undefined
    || options.auditLogRepository === undefined
    || options.occurrenceRepository === undefined
    || options.occurrenceEventRepository === undefined
    || options.categoryRepository === undefined
    || options.locationRepository === undefined
    || options.systemConfigRepository === undefined
    || options.operationalTeamRepository === undefined
    || options.slaConfigRepository === undefined
    || options.photoService === undefined;
  const firebase = options.firebase ?? (needsFirebase ? getFirebaseAdminServices(environment) : undefined);
  if (needsFirebase && firebase === undefined) throw new Error('Não foi possível inicializar as dependências Firebase do servidor.');

  const tokenVerifier = options.tokenVerifier ?? new FirebaseTokenService(firebase!);
  const appCheckVerifier = options.appCheckVerifier ?? new AppCheckTokenService(firebase!);
  const adminUsersRepository = options.adminUserRepository ?? new FirestoreAdminUserRepository(firebase!.firestore);
  const auditLogs = options.auditLogRepository ?? new FirestoreAuditLogRepository(firebase!.firestore);
  const occurrences = options.occurrenceRepository ?? new FirestoreOccurrenceRepository(firebase!.firestore);
  const occurrenceEvents = options.occurrenceEventRepository ?? new FirestoreOccurrenceEventRepository(firebase!.firestore);
  const categories = options.categoryRepository ?? new FirestoreCategoryRepository(firebase!.firestore);
  const locations = options.locationRepository ?? new FirestoreLocationRepository(firebase!.firestore);
  const systemConfigs = options.systemConfigRepository ?? new FirestoreSystemConfigRepository(firebase!.firestore);
  const teams = options.operationalTeamRepository ?? new FirestoreOperationalTeamRepository(firebase!.firestore);
  const slaConfigs = options.slaConfigRepository ?? new FirestoreSlaConfigRepository(firebase!.firestore);
  const photoService = options.photoService ?? new PhotoService(
    options.photoObjectRepository ?? new CloudStoragePhotoRepository(firebase!.bucket),
    options.photoMetadataRepository ?? new FirestorePhotoMetadataRepository(firebase!.firestore),
    options.storageCleanupTaskRepository ?? new FirestoreStorageCleanupTaskRepository(firebase!.firestore),
    new ImageProcessingService(),
  );

  const authorization = new AdminAuthorizationService(adminUsersRepository, auditLogs, environment.allowedAdminDomains);
  const adminUserService = new AdminUserService(adminUsersRepository, auditLogs, environment.allowedAdminDomains);
  const configService = new ConfigService(systemConfigs, categories, locations, auditLogs, {
    emulatorMode: environment.emulatorMode,
    appCheckEnforced: environment.appCheckEnforcement,
  });
  const occurrenceService = new OccurrenceService(
    occurrences,
    occurrenceEvents,
    categories,
    locations,
    systemConfigs,
    adminUsersRepository,
    teams,
    slaConfigs,
    auditLogs,
    photoService,
  );

  const operationalAdminService = new OperationalAdminService(categories, locations, teams, slaConfigs, adminUsersRepository, occurrences, auditLogs, photoService);

  const app = express();
  app.disable('x-powered-by');
  app.use(assignCorrelationId);
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', createApiRouter({
    tokenVerifier,
    appCheckVerifier,
    appCheckEnforced: environment.appCheckEnforcement,
    authorization,
    adminUsers: adminUserService,
    config: configService,
    occurrence: occurrenceService,
    operations: operationalAdminService,
  }));
  app.use(errorHandler);
  return app;
}
