import type { APP_VERSION } from '../config/version';

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  resolutionBaseBusinessHours: number;
  version: number;
}

export interface RoomLocation {
  id: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
}
export interface FloorLocation {
  id: string;
  name: string;
  rooms: RoomLocation[];
}
export interface BuildingLocation {
  id: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
  floors: FloorLocation[];
}
export interface CampusLocation {
  id: string;
  campusName: string;
  buildings: BuildingLocation[];
  provisional?: boolean;
  version?: number;
}

export interface SystemConfig {
  institutionDisplayName: string;
  protocolPrefix: string;
  notificationEmails: string[];
  emailNotificationsEnabled: boolean;
  autoAssignRisk: boolean;
  serviceNotice: string;
}
export interface PublicSystemConfig { institutionDisplayName: string; serviceNotice: string; }
export interface RuntimeInfo {
  version: typeof APP_VERSION;
  emulatorMode: boolean;
  firebaseIntegrated: true;
  publicAuthentication: 'firebase-anonymous';
  adminAuthentication: 'google';
  adminAuthorization: 'firestore';
  occurrencePersistence: 'firestore';
  referenceDataPersistence: 'firestore';
  photoStorage: 'cloudflare-r2' | 'firebase-storage-emulator';
  photoUploadEnabled: true;
  maxInitialPhotos: 3;
  maxResolutionPhotos: 3;
  emailDelivery: boolean;
  frontendHosting: 'cloudflare-pages';
  backendRuntime: 'cloud-run';
  appCheckEnforced: boolean;
}
export interface BootstrapData {
  config: PublicSystemConfig;
  categories: CategoryItem[];
  locations: CampusLocation[];
  runtime: RuntimeInfo;
}
