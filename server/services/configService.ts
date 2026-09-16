import { APP_VERSION } from '../../src/config/version';
import type { AuthorizedAdminProfile } from '../../src/models/admin';
import type { BootstrapData, SystemConfig } from '../../src/models/config';
import { normalizeProtocolPrefix } from '../../src/utils/protocol';
import type { AuditLogRepository } from '../repositories/auditLogRepository';
import type { CategoryRepository } from '../repositories/categoryRepository';
import type { LocationRepository } from '../repositories/locationRepository';
import type { SystemConfigRepository } from '../repositories/systemConfigRepository';
import { HttpError } from '../types/errors';

export interface ConfigRuntimeOptions {
  emulatorMode: boolean;
  appCheckEnforced: boolean;
}

export class ConfigService {
  public constructor(
    private readonly configs: SystemConfigRepository,
    private readonly categories: CategoryRepository,
    private readonly locations: LocationRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly runtime: ConfigRuntimeOptions,
  ) {}

  public async getBootstrap(): Promise<BootstrapData> {
    const [config, categories, locations] = await Promise.all([
      this.configs.get(),
      this.categories.listActive(),
      this.locations.list(),
    ]);
    if (config === undefined) {
      throw new HttpError(
        503,
        'REFERENCE_DATA_NOT_INITIALIZED',
        'A configuração operacional ainda não foi inicializada. Execute o seed explícito de dados de referência no ambiente autorizado.',
      );
    }
    return {
      config: {
        institutionDisplayName: config.institutionDisplayName,
        serviceNotice: config.serviceNotice,
      },
      categories,
      locations,
      runtime: {
        version: APP_VERSION,
        emulatorMode: this.runtime.emulatorMode,
        firebaseIntegrated: true,
        publicAuthentication: 'firebase-anonymous',
        adminAuthentication: 'google',
        adminAuthorization: 'firestore',
        occurrencePersistence: 'firestore',
        referenceDataPersistence: 'firestore',
        photoStorage: 'firebase-storage',
        photoUploadEnabled: true,
        maxInitialPhotos: 3,
        maxResolutionPhotos: 3,
        emailDelivery: false,
        appCheckEnforced: this.runtime.appCheckEnforced,
      },
    };
  }

  public async getOperationalConfig(): Promise<SystemConfig> {
    const config = await this.configs.get();
    if (config === undefined) {
      throw new HttpError(503, 'REFERENCE_DATA_NOT_INITIALIZED', 'A configuração operacional ainda não foi inicializada.');
    }
    return config;
  }

  public async updateConfig(
    input: Partial<SystemConfig>,
    author: AuthorizedAdminProfile,
    correlationId: string,
  ): Promise<SystemConfig> {
    const current = await this.getOperationalConfig();
    const next: SystemConfig = {
      institutionDisplayName: input.institutionDisplayName ?? current.institutionDisplayName,
      protocolPrefix: input.protocolPrefix === undefined ? current.protocolPrefix : normalizeProtocolPrefix(input.protocolPrefix),
      notificationEmails: input.notificationEmails ?? current.notificationEmails,
      autoAssignRisk: input.autoAssignRisk ?? current.autoAssignRisk,
      serviceNotice: input.serviceNotice ?? current.serviceNotice,
    };
    const saved = await this.configs.update(next, author.id);
    await this.auditLogs.write({
      eventType: 'SYSTEM_CONFIG_UPDATED',
      actorUid: author.uid,
      actorEmail: author.email,
      actorRole: author.role,
      targetType: 'systemConfig',
      targetId: 'operational',
      summary: 'Configuração operacional atualizada.',
      requestCorrelationId: correlationId,
    });
    return saved;
  }
}
