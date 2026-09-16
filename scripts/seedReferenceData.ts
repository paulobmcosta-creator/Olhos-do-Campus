import 'dotenv/config';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { FirestoreCategoryRepository } from '../server/repositories/categoryRepository';
import { FirestoreLocationRepository } from '../server/repositories/locationRepository';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_LOCATIONS, REFERENCE_CATEGORIES } from '../server/repositories/referenceSeedData';
import { FirestoreSlaConfigRepository } from '../server/repositories/slaConfigRepository';
import { FirestoreSystemConfigRepository } from '../server/repositories/systemConfigRepository';

const explicitConfirmation = process.env.ALLOW_NON_EMULATOR_REFERENCE_SEED === 'CONFIRM_REFERENCE_SEED';
if (!SERVER_ENV.emulatorMode && !explicitConfirmation) throw new Error('Seed fora do Emulator Suite bloqueado. Defina ALLOW_NON_EMULATOR_REFERENCE_SEED=CONFIRM_REFERENCE_SEED somente após confirmar o projeto de destino.');
const { firestore } = getFirebaseAdminServices(SERVER_ENV);
const actor = `seed-reference-data:0.6.0:${SERVER_ENV.firebaseProjectId}`;
await new FirestoreSystemConfigRepository(firestore).seed(DEFAULT_OPERATIONAL_CONFIG, actor);
await new FirestoreCategoryRepository(firestore).seed(REFERENCE_CATEGORIES, actor);
await new FirestoreLocationRepository(firestore).seed(REFERENCE_LOCATIONS, actor);
await new FirestoreSlaConfigRepository(firestore).seedDefaults(actor);
console.log(`Seed institucional idempotente concluído em ${SERVER_ENV.firebaseProjectId}.`);
console.log(`Banco Firestore: ${SERVER_ENV.firestoreDatabaseId}. Categorias, 60 ambientes e defaults de SLA/calendário foram verificados sem sobrescrever personalizações existentes.`);
