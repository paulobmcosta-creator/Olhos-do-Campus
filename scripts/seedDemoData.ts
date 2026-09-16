import 'dotenv/config';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';
import { createSlaSnapshot } from '../server/domain/sla';
import type { NewOccurrenceEvent, NewOccurrenceRecord } from '../server/models/occurrenceDomain';
import { FirestoreOccurrenceRepository } from '../server/repositories/occurrenceRepository';
import { DEFAULT_SERVICE_CALENDAR, DEFAULT_SLA_CONFIG, REFERENCE_CATEGORIES } from '../server/repositories/referenceSeedData';
import { generateTrackingKey, hashTrackingKey } from '../server/utils/trackingKey';

if (SERVER_ENV.isProduction) throw new Error('O seed demonstrativo é proibido em produção.');
const explicitDevelopment = process.env.ALLOW_NON_EMULATOR_DEMO_SEED === 'CONFIRM_DEVELOPMENT_DEMO_SEED';
if (!SERVER_ENV.emulatorMode && !explicitDevelopment) throw new Error('Seed demonstrativo fora do Emulator Suite bloqueado. Use ALLOW_NON_EMULATOR_DEMO_SEED=CONFIRM_DEVELOPMENT_DEMO_SEED somente em projeto descartável de desenvolvimento.');
const { firestore } = getFirebaseAdminServices(SERVER_ENV);
const repository = new FirestoreOccurrenceRepository(firestore);
const now = new Date();
const policy = { calendar: DEFAULT_SERVICE_CALENDAR, exceptions: [] };
const examples = [
  ['cat-iluminacao', 'bloco-01', 'sala-de-aula-1', 'Bloco 01', 'SALA DE AULA 1', 'Luminária sem funcionamento em registro demonstrativo.'],
  ['cat-climatizacao', 'bloco-02', 'laboratorio-de-informatica', 'Bloco 02', 'LABORATORIO DE INFORMÁTICA', 'Equipamento de climatização sem resfriamento em registro demonstrativo.'],
  ['cat-hidraulica', 'bloco-01', 'banheiro-masculino-alunos', 'Bloco 01', 'BANHEIRO MASCULINO ALUNOS', 'Vazamento demonstrativo em ponto hidráulico.'],
  ['cat-sinalizacao', 'externo', 'patio-de-alimentacao', 'Externo', 'PÁTIO DE ALIMENTAÇÃO', 'Sinalização demonstrativa necessita reposicionamento.'],
] as const;
for (const [categoryId, buildingId, roomId, buildingName, room, description] of examples) {
  const category = REFERENCE_CATEGORIES.find((item) => item.id === categoryId); if (!category) throw new Error(`Categoria de demonstração ausente: ${categoryId}`);
  const originalKey = generateTrackingKey(); const derived = await hashTrackingKey(originalKey);
  const input: NewOccurrenceRecord = {
    trackingKeyHash: derived.trackingKeyHash, trackingKeySalt: derived.trackingKeySalt,
    categoryId, categoryNameSnapshot: category.name,
    location: { campusId: 'ifes-bsf', campusName: 'IFES — Campus Barra de São Francisco', buildingId, buildingName, floorId: 'sem-pavimento', floor: '', roomId, room },
    description, immediateRisk: false, priority: 'Normal', dataClassification: 'TEST',
    sla: createSlaSnapshot(now, 'Normal', category, DEFAULT_SLA_CONFIG, policy),
    searchTokens: description.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().split(/[^a-z0-9]+/u).filter((part) => part.length >= 2),
  };
  const event: NewOccurrenceEvent = { eventType: 'OCCURRENCE_CREATED', visibility: 'PUBLIC', createdAt: now, actorType: 'SYSTEM', publicDescription: 'Ocorrência demonstrativa registrada para validação do Emulator Suite.', correlationId: 'seed-demo-data-0.6.0', schemaVersion: 2 };
  await repository.createWithProtocol(input, 'INF', [event]);
}
console.log(`Quatro ocorrências TEST foram criadas em ${SERVER_ENV.firebaseProjectId}.`);
console.log('As chaves de acompanhamento geradas não são exibidas nem registradas em logs.');
