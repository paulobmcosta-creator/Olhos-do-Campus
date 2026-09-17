import express from 'express';
import type { Express } from 'express';
import type { FirebaseAdminServices } from './config/firebaseAdmin';
import { getFirebaseAdminServices, getFirebaseLegacyStorageBucket } from './config/firebaseAdmin';
import type { ServerEnvironment } from './config/env';
import { assignCorrelationId } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders } from './middleware/securityHeaders';
import { FirestoreAdminUserRepository } from './repositories/adminUserRepository';
import type { AdminUserRepository } from './repositories/adminUserRepository';
import { FirestoreAuditLogRepository } from './repositories/auditLogRepository';
import type { AuditLogRepository } from './repositories/auditLogRepository';
import { FirestoreCategoryRepository } from './repositories/categoryRepository';
import type { CategoryRepository } from './repositories/categoryRepository';
import { CloudStoragePhotoRepository } from './repositories/cloudStoragePhotoRepository';
import { FallbackPhotoRepository } from './repositories/fallbackPhotoRepository';
import { FirestoreInfrastructureRepository } from './repositories/infrastructureRepository';
import { FirestoreNotificationOutboxRepository } from './repositories/notificationOutboxRepository';
import { R2PhotoRepository } from './repositories/r2PhotoRepository';
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
import { createNotificationController } from './controllers/notificationController';
import { restrictedCors } from './middleware/cors';
import { requireMaintenanceSignature } from './middleware/requireMaintenanceSignature';
import { AdminAuthorizationService } from './services/adminAuthorizationService';
import { AdminUserService } from './services/adminUserService';
import { AppCheckTokenService } from './services/appCheckTokenService';
import { ConfigService } from './services/configService';
import { FirebaseTokenService } from './services/firebaseTokenService';
import { ImageProcessingService } from './services/imageProcessingService';
import { OccurrenceService } from './services/occurrenceService';
import { PhotoService } from './services/photoService';
import { OperationalAdminService } from './services/operationalAdminService';
import { InfrastructureService } from './services/infrastructureService';
import { NotificationService } from './services/notificationService';
import { ResendEmailProvider } from './providers/resendEmailProvider';
import { EwsEmailProvider } from './providers/ewsEmailProvider';
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
  notificationService?: NotificationService;
  infrastructureService?: InfrastructureService;
}

let legacyFallbackReads = 0;
function recordLegacyFallback(): void {
  legacyFallbackReads += 1;
  if (legacyFallbackReads === 1 || legacyFallbackReads % 100 === 0) {
    console.warn(`Fallback agregado para Firebase Storage legado utilizado ${legacyFallbackReads} vez(es) nesta instância.`);
  }
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new Error(`${name} não está configurado.`);
  return value;
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
    || options.photoService === undefined
    || options.notificationService === undefined
    || options.infrastructureService === undefined;
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
  const legacyStorageNeeded = environment.photoStorageProvider === 'firebase-storage' || environment.legacyPhotoFallbackEnabled;
  const legacyObjects = !legacyStorageNeeded || environment.firebaseStorageBucket === '' || firebase === undefined
    ? undefined
    : new CloudStoragePhotoRepository(getFirebaseLegacyStorageBucket(environment, firebase.app));
  const primaryObjects = options.photoObjectRepository ?? (environment.photoStorageProvider === 'r2'
    ? new R2PhotoRepository({
        accountId: required(environment.r2AccountId, 'R2_ACCOUNT_ID'), accessKeyId: required(environment.r2AccessKeyId, 'R2_ACCESS_KEY_ID'),
        secretAccessKey: required(environment.r2SecretAccessKey, 'R2_SECRET_ACCESS_KEY'), bucketName: required(environment.r2BucketName, 'R2_BUCKET_NAME'),
        endpoint: required(environment.r2Endpoint, 'R2_ENDPOINT'),
      })
    : legacyObjects!);
  const photoObjects = options.photoObjectRepository !== undefined || !environment.legacyPhotoFallbackEnabled
    ? primaryObjects
    : new FallbackPhotoRepository(primaryObjects, legacyObjects!, recordLegacyFallback);
  const photoMetadata = options.photoMetadataRepository ?? (firebase === undefined ? undefined : new FirestorePhotoMetadataRepository(firebase.firestore));
  const cleanupTasks = options.storageCleanupTaskRepository ?? (firebase === undefined ? undefined : new FirestoreStorageCleanupTaskRepository(firebase.firestore));
  const photoService = options.photoService ?? new PhotoService(photoObjects, photoMetadata!, cleanupTasks!, new ImageProcessingService());
  const outbox = firebase === undefined ? undefined : new FirestoreNotificationOutboxRepository(firebase.firestore);
  const resendProvider = environment.resendApiKey === undefined ? undefined : new ResendEmailProvider(environment.resendApiKey);
  const ewsProvider = (environment.ewsUrl && environment.ewsUsername && environment.ewsPassword)
    ? new EwsEmailProvider({
        url: environment.ewsUrl,
        domain: environment.ewsDomain,
        username: environment.ewsUsername,
        password: environment.ewsPassword,
      })
    : undefined;
  const notificationService = options.notificationService ?? new NotificationService(
    outbox!, systemConfigs, auditLogs, { resend: resendProvider, ews: ewsProvider },
    {
      activeProvider: environment.emailProvider,
      ewsEnabled: environment.ewsEnabled,
      resendEnabled: environment.resendEnabled,
      ewsFrom: environment.ewsFrom,
      resendFrom: environment.resendFrom,
      resendWebhookSecret: environment.resendWebhookSecret,
    },
  );
  const infrastructureService = options.infrastructureService ?? new InfrastructureService(
    new FirestoreInfrastructureRepository(firebase!.firestore), photoObjects, photoMetadata!, cleanupTasks!, outbox!, notificationService, auditLogs, legacyObjects,
  );

  const authorization = new AdminAuthorizationService(adminUsersRepository, auditLogs, environment.allowedAdminDomains);
  const adminUserService = new AdminUserService(adminUsersRepository, auditLogs, environment.allowedAdminDomains);
  const configService = new ConfigService(systemConfigs, categories, locations, auditLogs, {
    emulatorMode: environment.emulatorMode,
    appCheckEnforced: environment.appCheckEnforcement,
    photoStorage: environment.photoStorageProvider === 'r2' ? 'cloudflare-r2' : 'firebase-storage-emulator',
    emailDelivery: environment.emailProvider === 'ews' ? environment.ewsEnabled : environment.resendEnabled,
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
    environment.emailProvider,
  );

  const operationalAdminService = new OperationalAdminService(categories, locations, teams, slaConfigs, adminUsersRepository, occurrences, auditLogs, photoService);

  const app = express();
  app.disable('x-powered-by');
  app.use(assignCorrelationId);
  app.use(securityHeaders(environment.isProduction));
  app.use(restrictedCors(environment.allowedWebOrigins));
  const notificationController = createNotificationController(notificationService);
  app.post('/api/webhooks/resend', express.raw({ type: 'application/json', limit: '256kb' }), notificationController.webhook);
  app.use(express.json({
    limit: '256kb',
    verify: (request, _response, buffer) => {
      request.rawBody = buffer;
    },
  }));
  app.use('/api', createApiRouter({
    tokenVerifier,
    appCheckVerifier,
    appCheckEnforced: environment.appCheckEnforcement,
    authorization,
    adminUsers: adminUserService,
    config: configService,
    occurrence: occurrenceService,
    operations: operationalAdminService,
    notifications: notificationService,
    infrastructure: infrastructureService,
    maintenanceAuth: requireMaintenanceSignature(environment.maintenanceHmacSecret, environment.maintenanceReplayWindowSeconds),
  }));
  app.use(errorHandler);
  return app;
}
