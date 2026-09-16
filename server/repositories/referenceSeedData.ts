import type { CampusLocation, CategoryItem, SystemConfig } from '../../src/models/config';
import type { ServiceCalendar, SlaConfiguration } from '../../src/models/operations';

export const DEFAULT_OPERATIONAL_CONFIG: SystemConfig = {
  institutionDisplayName: 'Instituto Federal do Espírito Santo — Campus Barra de São Francisco',
  protocolPrefix: 'INF',
  notificationEmails: [],
  autoAssignRisk: true,
  serviceNotice: 'Canal destinado exclusivamente a problemas relacionados à infraestrutura física.',
};

const CATEGORY_ROWS: Array<[string,string,string,number]> = [
  ['cat-limpeza','Limpeza e conservação','Sujeira, resíduos, conservação e higienização de espaços.',30],
  ['cat-seguranca','Segurança física','Riscos materiais, grades, cercamentos e proteção do espaço.',40],
  ['cat-eletrica','Instalações elétricas','Tomadas, quadros, fiação, disjuntores e risco elétrico.',50],
  ['cat-hidraulica','Instalações hidráulicas','Vazamentos, torneiras, descargas, tubulações e drenagem.',50],
  ['cat-pragas','Pragas e animais','Insetos, roedores, animais e focos associados à infraestrutura.',50],
  ['cat-iluminacao','Iluminação','Lâmpadas, luminárias e pontos de iluminação.',60],
  ['cat-acessibilidade','Acessibilidade','Rampas, corrimãos, pisos táteis e barreiras de acesso.',80],
  ['cat-portas','Portas e janelas','Fechaduras, maçanetas, vidros, esquadrias e travamentos.',80],
  ['cat-climatizacao','Climatização','Ar-condicionado, ventilação e conforto térmico.',100],
  ['cat-sinalizacao','Sinalização','Placas, identificação de ambientes e sinalização de segurança.',100],
  ['cat-equipamentos','Equipamentos instalados','Equipamentos fixos ou incorporados à infraestrutura.',120],
  ['cat-mobiliario','Mobiliário','Mesas, cadeiras, armários e outros móveis institucionais.',120],
  ['cat-estrutura','Estrutura predial','Paredes, pisos, tetos, cobertura, infiltrações e fissuras.',160],
  ['cat-externa','Áreas externas','Calçadas, jardins, pátios, vias e drenagem externa.',160],
  ['cat-outros','Outros','Condições físicas não abrangidas pelas demais categorias.',120],
];
export const REFERENCE_CATEGORIES: CategoryItem[] = CATEGORY_ROWS.map(([id,name,description,hours], index) => ({
  id, name, description, active: true, sortOrder: index + 1, resolutionBaseBusinessHours: hours, version: 1,
}));

const slug = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLowerCase().replace(/[^a-z0-9]+/gu,'-').replace(/^-|-$/gu,'');
const rooms = (names: string[]) => names.map((name,index) => ({ id: slug(name), name, active: true, sortOrder: index + 1 }));

export const CAMPUS_SPACES: CampusLocation = {
  id: 'ifes-bsf',
  campusName: 'IFES — Campus Barra de São Francisco',
  provisional: false,
  version: 1,
  buildings: [
    { id: 'bloco-01', name: 'Bloco 01', active: true, sortOrder: 1, floors: [{ id: 'sem-pavimento', name: '', rooms: rooms([
      'DIREÇÃO DE ENSINO','SALA DA COORDENAÇÃO DO BACHARELADO EM ADMINISTRAÇÃO','COORDENADORIA DE GESTÃO PEDAGÓGICA',
      'COORDENADORIA DE REGISTROS ACADÊMICOS','COORDENAÇÕES DE CURSOS TÉCNICOS','COORDENADORIA DE ATENDIMENTO MULTIDISCIPLINAR',
      'COPA','COORDENADORIA DE APOIO AO ENSINO','SALA DOS PROFESSORES','NÚCLEO DE ATENDIMENTO ÀS PESSOAS COM NECESSIDADES ESPECÍFICAS',
      'SALA DE APOIO AO LABORATÓRIO','NÚCLEO DE ARTE E CULTURA','COORDENADORIA DO CURSO TÉCNICO EM AGROPECUÁRIA','SALA DE ATENDIMENTO',
      'SALA DE AULA 1','SALA DE AULA 2','SALA DE AULA 3','SALA DE AULA 4','SALA DE AULA 5','SALA DE AULA 6','AUDITÓRIO',
      'SALA DE APOIO DA LIMPEZA','BANHEIRO FEMININO PCD','BANHEIRO MASCULINO PCD','BANHEIRO FEMININO ALUNOS',
      'BANHEIRO MASCULINO ALUNOS','CORREDORES','OUTROS',
    ]) }] },
    { id: 'bloco-02', name: 'Bloco 02', active: true, sortOrder: 2, floors: [{ id: 'sem-pavimento', name: '', rooms: rooms([
      'DIRETORIA GERAL','MINIAUDITÓRIO','COORDENAÇÃO GERAL DE ADMINISTRAÇÃO / ENGENHARIA','DIREÇÃO DE ADMINISTRAÇÃO E PLANEJAMENTO',
      'COPA','COORDENADORIA DO ALMOXARIFADO','COORDENADORIA DE COMUNICAÇÃO E EVENTOS','COORDENADORIA GERAL DE GESTÃO DE PESSOAS',
      'DIRETORIA DE PESQUISA, PÓS-GRADUAÇÃO, EXTENSÃO E INOVAÇÃO','COORDENADORIA GERAL DE GESTÃO DO CAMPO','PROJETO INTEGRACAR',
      'SALA DE AULA 7','SALA DE AULA 8','SALA DE AULA 9','LABORATÓRIO DE SOLO','SALA DE MULTIMEIOS','LABORATORIO DE INFORMÁTICA',
      'COORDENADORIA DE TECNOLOGIA DA INFORMAÇÃO','GABINETE DA DIREÇÃO GERAL','BIBLIOTECA','BANHEIRO FEMININO PCD',
      'BANHEIRO MASCULINO PCD','BANHEIRO FEMININO ALUNOS','BANHEIRO MASCULINO ALUNOS','CORREDORES','OUTROS',
    ]) }] },
    { id: 'bloco-03', name: 'Bloco 03', active: true, sortOrder: 3, floors: [{ id: 'sem-pavimento', name: '', rooms: rooms(['SALA MODULAR 01','SALA MODULAR 02']) }] },
    { id: 'externo', name: 'Externo', active: true, sortOrder: 4, floors: [{ id: 'sem-pavimento', name: '', rooms: rooms(['GUARITA','PÁTIO DE ALIMENTAÇÃO','ESTACIONAMENTO','OUTROS']) }] },
  ],
};
export const REFERENCE_LOCATIONS: CampusLocation[] = [CAMPUS_SPACES];

export const DEFAULT_SERVICE_CALENDAR: ServiceCalendar = {
  id: 'default', schemaVersion: 1, timezone: 'America/Sao_Paulo', version: 1,
  weekly: {
    MONDAY: { open: true, start: '09:00', end: '19:00' },
    TUESDAY: { open: true, start: '09:00', end: '19:00' },
    WEDNESDAY: { open: true, start: '09:00', end: '19:00' },
    THURSDAY: { open: true, start: '09:00', end: '19:00' },
    FRIDAY: { open: true, start: '09:00', end: '19:00' },
    SATURDAY: { open: false, start: '09:00', end: '19:00' },
    SUNDAY: { open: false, start: '09:00', end: '19:00' },
  },
  updatedAt: new Date(0).toISOString(), updatedBy: 'seed-0.6.0',
};

export const DEFAULT_SLA_CONFIG: SlaConfiguration = {
  schemaVersion: 1,
  policyVersion: '0.6.0-default-v1',
  firstResponseBusinessHours: { Baixa: 30, Normal: 20, Alta: 10, Urgente: 4, Emergencial: 2 },
  priorityMultipliers: { Baixa: 1.5, Normal: 1, Alta: 0.8, Urgente: 0.6, Emergencial: 0.4 },
  nearDueThresholdPercent: 20,
  version: 1,
  updatedAt: new Date(0).toISOString(), updatedBy: 'seed-0.6.0',
};
