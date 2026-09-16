import 'dotenv/config';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { FirestoreLocationRepository } from '../server/repositories/locationRepository';
import { CAMPUS_SPACES } from '../server/repositories/referenceSeedData';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
if (args.has('--dry-run') && apply) throw new Error('Use apenas --dry-run ou --apply.');
const counts = Object.fromEntries(CAMPUS_SPACES.buildings.map((building) => [building.name, building.floors.reduce((sum, floor) => sum + floor.rooms.length, 0)]));
const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
console.log('Seed institucional de ambientes — versão 0.6.0');
console.log(JSON.stringify({ campus: CAMPUS_SPACES.campusName, counts, total, mode: apply ? 'APPLY' : 'DRY_RUN' }, null, 2));
if (total !== 60 || counts['Bloco 01'] !== 28 || counts['Bloco 02'] !== 26 || counts['Bloco 03'] !== 2 || counts.Externo !== 4) throw new Error('A carga institucional não contém a distribuição esperada de 60 ambientes.');
if (!apply) {
  console.log('Nenhuma escrita realizada. Execute novamente com --apply após revisar o projeto Firebase de destino.');
  process.exit(0);
}
const explicitConfirmation = process.env.ALLOW_NON_EMULATOR_CAMPUS_SPACES_SEED === 'CONFIRM_CAMPUS_SPACES_0_6';
if (!SERVER_ENV.emulatorMode && !explicitConfirmation) throw new Error('Seed fora do Emulator Suite bloqueado. Defina ALLOW_NON_EMULATOR_CAMPUS_SPACES_SEED=CONFIRM_CAMPUS_SPACES_0_6 somente após confirmar o destino.');
const { firestore } = getFirebaseAdminServices(SERVER_ENV);
await new FirestoreLocationRepository(firestore).seed([CAMPUS_SPACES], `seed-campus-spaces:0.6.0:${SERVER_ENV.firebaseProjectId}`);
console.log(`Seed idempotente concluído em ${SERVER_ENV.firebaseProjectId}; ambientes existentes não foram renomeados nem removidos.`);
