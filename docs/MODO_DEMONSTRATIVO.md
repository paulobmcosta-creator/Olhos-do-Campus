# Dados demonstrativos — comportamento ativo na versão 0.7.0

## 1. Princípio

A aplicação não possui uma segunda fonte de verdade em memória para ocorrências ou fotografias. Ocorrências, protocolos, histórico, categorias, localizações, configuração operacional e metadados de fotografias são persistidos no Firestore. Em produção, os bytes das fotografias são persistidos no Cloudflare R2 privado por intermédio do backend.

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

## 5. Fotografias na versão 0.7.0

Produção exige R2. No Emulator Suite, Auth, Firestore e Firebase Storage devem ser configurados em conjunto, evitando combinação acidental de serviços locais com bucket real. O Storage Emulator é apenas o backend local da mesma abstração e não representa a arquitetura produtiva.

A existência lógica da fotografia é definida pelo documento Firestore `occurrences/{occurrenceId}/photos/{photoId}`. Os bytes produtivos são armazenados no R2. Clientes Web não acessam bucket diretamente; toda leitura e gravação passa pela API Express.
