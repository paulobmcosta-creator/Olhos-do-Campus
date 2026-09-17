import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/config/version';
import { bootstrapResponseSchema } from '../src/validators/responses';

describe('contrato de bootstrap e versão ativa 0.7.5', () => {
  it('aceita a versão ativa retornada pelo backend', () => {
    const payload = {
      config: { institutionDisplayName: 'IFES — Campus Barra de São Francisco', serviceNotice: '' },
      categories: [],
      locations: [],
      runtime: {
        version: APP_VERSION,
        emulatorMode: false,
        firebaseIntegrated: true,
        publicAuthentication: 'firebase-anonymous',
        adminAuthentication: 'google',
        adminAuthorization: 'firestore',
        occurrencePersistence: 'firestore',
        referenceDataPersistence: 'firestore',
        photoStorage: 'cloudflare-r2',
        photoUploadEnabled: true,
        maxInitialPhotos: 3,
        maxResolutionPhotos: 3,
        emailDelivery: false,
        frontendHosting: 'cloudflare-pages', backendRuntime: 'cloud-run',
        appCheckEnforced: false,
      },
    };
    expect(bootstrapResponseSchema.parse(payload).runtime.version).toBe(APP_VERSION);
  });

  it('rejeita versão de runtime diferente da versão ativa', () => {
    const parsed = bootstrapResponseSchema.safeParse({
      config: { institutionDisplayName: 'IFES', serviceNotice: '' },
      categories: [],
      locations: [],
      runtime: {
        version: '0.6.0', emulatorMode: false, firebaseIntegrated: true,
        publicAuthentication: 'firebase-anonymous', adminAuthentication: 'google',
        adminAuthorization: 'firestore', occurrencePersistence: 'firestore',
        referenceDataPersistence: 'firestore', photoStorage: 'cloudflare-r2',
        photoUploadEnabled: true, maxInitialPhotos: 3, maxResolutionPhotos: 3,
        emailDelivery: false, frontendHosting: 'cloudflare-pages', backendRuntime: 'cloud-run', appCheckEnforced: false,
      },
    });
    expect(parsed.success).toBe(false);
  });
});
