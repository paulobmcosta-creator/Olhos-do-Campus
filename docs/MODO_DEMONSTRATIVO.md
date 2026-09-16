# Dados demonstrativos — versão 0.5.0

## 1. Princípio

A versão 0.5.0 não possui uma segunda fonte de verdade em memória para ocorrências ou fotografias. Ocorrências, protocolos, histórico, categorias, localizações, configuração operacional e metadados de fotografias são persistidos no Firestore. Os bytes das fotografias são persistidos exclusivamente no Cloud Storage for Firebase, por intermédio do backend.

Não existem mais `ENABLE_TEMPORARY_PHOTO_STORAGE`, `InMemoryPhotoRepository` ou armazenamento temporário de fotografias no runtime de produção.

## 2. O que “demonstrativo” significa

O termo refere-se somente a **dados demonstrativos inseridos por script explícito**. Esses dados não substituem os serviços Firebase e não são carregados automaticamente na inicialização normal da aplicação.

## 3. Seed demonstrativo

`npm run firebase:seed-demo-data` cria ocorrências de demonstração.

Proteções:

- execução proibida quando `NODE_ENV=production`;
- Emulator Suite é o destino padrão esperado;
- fora do emulador, exige `ALLOW_NON_EMULATOR_DEMO_SEED=CONFIRM_DEVELOPMENT_DEMO_SEED`;
- a confirmação destina-se apenas a projeto descartável de desenvolvimento;
- chaves de acompanhamento geradas não são impressas em console;
- nenhuma ocorrência demonstrativa é criada durante a inicialização normal do servidor.

## 4. Localizações provisórias

Os locais fornecidos no seed de referência são identificados como provisórios/demonstrativos. Eles não representam cadastro físico oficial do campus e devem ser substituídos quando a estrutura institucional confirmada for fornecida.

## 5. Fotografias na versão 0.5.0

Fotografias reais utilizam Cloud Storage inclusive em desenvolvimento, quando o fluxo fotográfico é exercitado. No Emulator Suite, Auth, Firestore e Storage devem ser configurados em conjunto, evitando combinação acidental de serviços locais com bucket real.

A existência lógica da fotografia é definida pelo documento Firestore `occurrences/{occurrenceId}/photos/{photoId}`. Os bytes são armazenados no Storage. Clientes Web não acessam o bucket diretamente; toda leitura e gravação passa pela API Express e pelo Firebase Admin SDK.
