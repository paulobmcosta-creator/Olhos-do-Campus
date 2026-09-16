# Changelog

## [0.6.2] - 2026-08-17

### Corrigido

- Corrigida incompatibilidade entre o runtime do backend e o schema de bootstrap do frontend após o hotfix 0.6.1.
- `RuntimeInfo.version` e `bootstrapResponseSchema` agora derivam diretamente de `APP_VERSION`, eliminando o literal residual `0.6.0` que fazia `/api/config` ser rejeitado no Preview.
- A página inicial e a geração de `policyVersion` do SLA deixaram de hardcodar a versão ativa.
- Testes de coerência de versão foram refatorados para usar `APP_VERSION`.
- Adicionado teste de regressão `bootstrapContractVersion062.test.ts`.

### Preservado

- Mantida integralmente a correção de empacotamento da 0.6.1 (`npm prune --omit=dev` após o build).
- Nenhuma alteração em modelos persistidos, permissões, Firestore, Storage, App Check, SLA histórico, categorias, locais, equipes ou fluxos de ocorrência.

## [0.6.1] - 2026-08-17

### Publicação e empacotamento
- Corrige o empacotamento de produção do AI Studio/Cloud Run sem alterar funcionalidades da aplicação.
- Adiciona `scripts/prepareProductionPackage.mjs` como etapa final do `npm run build`.
- Executa `npm prune --omit=dev --no-audit --no-fund` somente depois de Vite e esbuild concluírem a compilação, removendo ferramentas de desenvolvimento do `node_modules` que será empacotado.
- Remove defensivamente `bun.lock` e `bun.lockb` caso sejam gerados pelo ambiente, preservando npm + `package-lock.json` como mecanismo oficial do projeto.
- A preparação falha explicitamente se o prune não concluir, impedindo a geração silenciosa de pacote inconsistente.
- Adiciona teste de regressão específico para preservação de dependências de produção, remoção de dependências de desenvolvimento e remoção dos lockfiles Bun.

### Diagnóstico que motivou o hotfix
- A tentativa de Publish gerou `build_artifacts.tar.gz` com 249.560.700 bytes e 39.388 entradas em `node_modules`.
- O arquivo gerado pelo AI Studio foi comprovadamente truncado (`gzip: unexpected end of file`; `tar: Unexpected EOF in archive`) e o Cloud Run retornou `The provided source archive is corrupted.`
- A correção não modifica controllers, services, repositories, models, páginas, Firebase, SLA, permissões ou regras de negócio da 0.6.0.

## [0.6.0] - 2026-08-16

### Base e governança
- Implementação realizada sobre o ZIP 0.5.1 por autorização expressa do usuário, substituindo a trava originalmente escrita para 0.5.2; nenhuma reconstrução intermediária da 0.5.2 foi presumida.
- Versão ativa atualizada em package, lockfile, metadata, RuntimeInfo, health endpoint, README, Blueprint e documentação.

### Administração e autorização
- Papéis ativos reduzidos a Administrador e Gestor.
- `Atendente` mantido somente como valor legado detectável e bloqueado; resolução explícita por Administrador para conversão em Gestor ou inativação.
- Equipes/setores responsáveis, associação de membros e responsável individual opcional.
- Separação de funções estruturais exclusivas do Administrador e funções operacionais disponíveis ao Gestor.

### Ocorrências
- Preservação imutável de `reportedCategory*` e `reportedLocation`, com categoria/local atuais corrigíveis mediante justificativa.
- Risco imediato inicia prioridade Urgente; prioridade padrão sem risco permanece Normal; Emergencial é classificação administrativa.
- `closedAt` para todo encerramento terminal e `resolvedAt` exclusivo de Resolvida.
- Novos eventos de categoria, local, prioridade, equipe, responsável, pausa/retomada de SLA e reabertura.
- Observações internas com audiências `ADMIN_ONLY`, `ADMINS_AND_MANAGERS` e `RESPONSIBLE_TEAM`.
- Classificação explícita `REAL | TEST`; expurgo físico somente de TEST por Administrador, com auditoria preservada.

### SLA e calendário
- Calendário de horas úteis em `America/Sao_Paulo`, padrão segunda–sexta 09:00–19:00, com exceções de feriado, recesso, suspensão e horário especial.
- SLA de primeira resposta por prioridade; primeira resposta passa a ser a primeira mudança de situação visível publicamente.
- SLA-base de conclusão por categoria, multiplicadores por prioridade, snapshot histórico da política/calendário e estado de proximidade de 20%.
- Pausa de SLA efetivo em Aguardando material e Aguardando contratação ou serviço externo, sem interromper o tempo total.
- Recalibração de categoria/prioridade sem reinício do relógio e preservação do resultado histórico da primeira resposta.

### Dados de referência
- Carga institucional de 60 ambientes: Bloco 01 (28), Bloco 02 (26), Bloco 03 (2) e Externo (4), sem pavimentos inventados.
- Seed aditivo/idempotente dos ambientes e defaults de SLA/calendário.
- Migração 0.6 explícita, dry-run por padrão e sem promoção automática de papéis legados.

### Painel, consultas e relatórios
- Paginação por cursor com 25/50/100 registros, filtros administrativos e ordenações operacional, recente, antiga, prioridade, SLA e protocolo.
- Dashboard operacional enxuto com polling de 60 segundos e atualização manual não destrutiva.
- Painel analítico em `/administracao/indicadores` com período padrão de 30 dias, médias, medianas, cumprimento de SLA e distribuições.
- Auditoria global paginada e exclusiva do Administrador.
- Exportações CSV, XLSX e PDF com limite de 2.000 registros e evento `REPORT_EXPORTED`.

### Segurança e qualidade
- Firestore e Storage continuam deny-all para clientes Web; Firebase Admin permanece server-only.
- Auth, App Check, protocolo + chave fora da URL, EXIF removal e optimistic locking preservados.
- Testes de regressão ampliados para SLA, calendário, espaços institucionais, paginação, exportação, audiência e permissões.
- Corrigida a documentação ativa que ainda descrevia a matriz de papéis e locais demonstrativos da série 0.5.x.

## [0.5.1] - 2026-08-16

### Segurança e dependências
- Atualiza `sharp` de 0.34.1 para 0.35.3, incluindo libvips corrigido para os advisories reportados na cadeia de processamento de imagens.
- Adiciona defesa em profundidade: bloqueio de loaders GIF/TIFF/VIPS no libvips e validação prévia de assinatura binária para aceitar somente JPEG, PNG e WebP antes da decodificação.
- Fixa `uuid` 11.1.1 especificamente sob `gaxios` e `teeny-request`, sem downgrade do Firebase Admin SDK.
- Fixa `@opentelemetry/core` 2.8.0 na árvore de desenvolvimento do Firebase CLI.
- Atualiza `nanoid` transitivo para 3.3.18 no lockfile.

### Correções
- Corrige a tipagem estrita do `Content-Type` entregue ao Busboy.
- Remove propriedade privada não utilizada no repositório de tarefas de limpeza.
- Separa `storageIntegration.test.ts` da suíte unitária ordinária; a integração continua coberta por `npm run test:storage`.
- Executa as suítes HTTP multipart e Firebase/Storage em ambiente Vitest `node`, evitando incompatibilidades do `FormData`/`import.meta.url` sob `jsdom`, e torna o setup global seguro nos dois ambientes.
- Atualiza o teste de regras do Storage para a API atual, sem atribuir propriedades getter-only do SDK compat.

### Compatibilidade
- Mantém a arquitetura, modelo de dados, regras server-only, protocolo/chave, papéis administrativos e ciclo de fotografias homologados na 0.5.0.

## [0.5.0] - 2026-08-13

### Fotografias e Cloud Storage
- Substituído o armazenamento temporário em memória por Cloud Storage for Firebase acessado exclusivamente pelo Firebase Admin SDK.
- Criada resolução segura do bucket por variável de ambiente, configuração do AI Studio compatível com o projeto ativo ou bucket local do Emulator Suite.
- Auth, Firestore e Storage Emulator passam a ser exigidos conjuntamente em modo local.
- Upload público e administrativo migrado de Data URL/JSON para `multipart/form-data`, com até três fotografias por conjunto e 8 MB por arquivo recebido.
- Adicionado processamento autoritativo com `sharp`: detecção/decodificação, limite de pixels, auto-orientação, redimensionamento, reencodificação WebP, miniatura e SHA-256.
- A nova codificação não preserva EXIF, GPS, XMP, IPTC, comentários nem nome original.
- Criada subcoleção `occurrences/{id}/photos/{photoId}` e tarefas persistentes `storageCleanupTasks`.
- Criados eventos `PHOTO_ADDED`, `PHOTO_DELETED` e `PHOTO_VISIBILITY_CHANGED`.
- Fotografias iniciais são internas; fotografias de solução também nascem internas e só Administrador/Gestor podem torná-las públicas.
- Criados endpoints protegidos para streaming público e administrativo sem signed URL permanente e sem chave de acompanhamento em URL.
- Exclusão passou a ser lógica no Firestore e física compensada no Storage; falhas físicas geram cleanup idempotente.
- Operações administrativas de fotografia participam do optimistic locking da ocorrência.

### Frontend
- Formulário público suporta câmera/galeria, até três imagens, pré-visualização, remoção, revisão de quantidade e upload multipart.
- Processamento preliminar no navegador produz WebP/Blob e Object URLs temporárias, revogadas quando não são mais necessárias.
- Detalhe administrativo recebeu galeria separada entre fotografias do registro e da solução, com miniaturas protegidas e ações por papel.
- Consulta pública exibe somente fotografias de solução explicitamente públicas.

### Segurança
- `storage.rules` permanece deny-all para clientes Web; `firestore.rules` também nega acesso direto às subcoleções de fotos e tarefas de cleanup.
- Removidos contratos ativos `photoDataUrl`/`solutionPhotoDataUrl` e flags/repositórios de armazenamento temporário.
- Limite de `express.json` reduzido para payloads JSON ordinários.
- Paths, bucket, checksum e identificadores administrativos não são expostos nos DTOs de fotografia.

### Testes e documentação
- Adicionados testes de processamento de imagem e fixtures sintéticas com EXIF/GPS/XMP.
- Adicionados testes de Storage Repository, compensação/cleanup, APIs públicas/administrativas, frontend, rules e integração Firestore + Storage.
- Adicionado `npm run storage:cleanup` e `npm run test:storage`.
- Documentação atualizada para arquitetura, Firebase/AI Studio, Storage, processamento, política de fotografias, metadados, segurança, órfãos, testes e inspeção final.

### Validação da base 0.4.1
- A etapa zero foi reexecutada. O ambiente de produção desta entrega não foi alterado nem recebeu deploy. Resultados efetivos e limitações da instalação npm estão registrados em `docs/TESTES_0.5.0.md`.

Todas as alterações relevantes do projeto são registradas neste arquivo.

## [0.4.1] — 2026-08-13

### Corrigido

- Preview do Google AI Studio deixou de cair no projeto fictício `olhos-do-campus-local` quando o Emulator Suite não está ativo;
- Firebase Admin SDK passou a selecionar explicitamente o banco Firestore nomeado provisionado pelo AI Studio;
- frontend passou a utilizar `firebase-applet-config.json` como fallback de configuração pública fora do Emulator, evitando tentativa de autenticação em `127.0.0.1` no Preview;
- `firebase:bootstrap-admin`, seed de referência e seed demonstrativo passaram a operar sobre o mesmo `firestoreDatabaseId` resolvido pelo servidor;
- `firebase-blueprint.json` foi alinhado ao domínio real da 0.4.x, removendo campos/estados inexistentes como `title`, `locationId`, `assignedTo`, `REGISTRADA` e `sequence`;
- teste de regras do Storage voltou a comprovar escrita negada, além de leitura e listagem negadas.

### Adicionado

- `server/config/firebaseRuntime.ts`, responsável por carregar somente os identificadores não secretos necessários de `firebase-applet-config.json` e resolver projeto/banco de forma testável;
- `FIRESTORE_DATABASE_ID` como override explícito do banco Firestore;
- `firebase.ai-studio.json`, configuração dedicada de regras e índices para o databaseId nomeado provisionado pelo AI Studio;
- testes unitários de resolução de projeto/banco e do fail-fast do projeto local sem Emulator;
- documentação específica da integração Firebase/AI Studio 0.4.1.

### Alterado

- versão atualizada para 0.4.1 em package, lockfile, metadata, runtime, health, validadores e documentação ativa;
- `firebase.json` continua reservado ao fluxo local/Emulator; deploy de regras do banco nomeado utiliza configuração separada;
- App Check continua desabilitável apenas fora de produção; site key é exigida pelo frontend somente quando App Check estiver habilitado.

### Removido

- `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` de `metadata.json`; o sistema não depende de execução Gemini para funcionamento ordinário.

## [0.4.0] — 2026-08-10

### Adicionado

- persistência real do domínio de ocorrências no Cloud Firestore por repositórios especializados e assíncronos;
- coleção `protocolCounters/{year}` e criação transacional de protocolo, ocorrência e evento inicial;
- derivação da chave de acompanhamento com `scrypt`, salt aleatório por ocorrência e comparação com `timingSafeEqual`;
- endpoint público `POST /api/occurrences/track`, com protocolo e chave no corpo da requisição;
- DTO público por lista positiva de campos, sem atribuição administrativa, prioridade, IDs internos, autores administrativos, observações internas ou material criptográfico;
- subcoleção append-only `occurrences/{occurrenceId}/events/{eventId}` com visibilidades `PUBLIC` e `INTERNAL`;
- máquina formal de estados, resolução e reabertura explícita por Administrador ou Gestor;
- integridade de duplicidade, incluindo referência existente, autorreferência proibida e prevenção transacional de ciclos;
- atribuição administrativa por `assignedToAdminUserId` estável, vinculada a `adminUsers`;
- optimistic locking por `version` e `expectedVersion`, com HTTP 409 em conflito concorrente;
- persistência Firestore de categorias, localizações hierárquicas e `systemSettings/operational`;
- snapshots de categoria e localização dentro da ocorrência;
- abstração `PhotoRepository`, com implementação temporária em memória somente para desenvolvimento/emulador e implementação desabilitada para os demais ambientes;
- scripts `firebase:seed-reference-data` e `firebase:seed-demo-data` com proteções contra execução acidental fora do Emulator Suite;
- agregações Firestore para os indicadores que podem ser calculados corretamente nesta versão e sinalização explícita das métricas indisponíveis;
- limite operacional de 100 ocorrências por listagem e sinalização `truncated`;
- testes unitários, de API, regras e integração preparados para concorrência de protocolo, persistência, visibilidade, papéis, duplicidade e concorrência otimista;
- documentação específica de modelo Firestore, histórico, fluxo de situações, protocolo/chave, dados de referência, migração, segurança, implementação, testes e inspeção final.

### Alterado

- ocorrências, protocolos, histórico, categorias, localizações e configuração operacional deixaram de utilizar `InMemoryDatabase` como fonte de verdade;
- `GET /api/admin/occurrences`, `GET /api/admin/occurrences/:id`, `PATCH /api/admin/occurrences/:id` e `GET /api/admin/stats` passaram a operar sobre Firestore;
- `PATCH /api/admin/occurrences/:id` passou a exigir `expectedVersion`;
- a configuração pública passou a expor somente a denominação institucional exibida e o aviso de serviço; parâmetros administrativos completos são consultados em rota restrita ao Administrador;
- a atribuição deixou de aceitar nome, e-mail ou UID como identificador de responsável;
- datas persistidas do domínio passaram a utilizar `Timestamp` do Firestore e são serializadas para ISO 8601 somente na API;
- o significado de modo demonstrativo foi removido do runtime de ocorrências; demonstração passou a designar apenas dados carregados por seed explícito;
- o banner de demonstração foi substituído por aviso específico de armazenamento temporário de fotografias;
- a interface pública desabilita anexos quando não há armazenamento temporário habilitado, evitando perda silenciosa;
- a consulta administrativa informa quando filtros secundários foram aplicados sobre uma leitura truncada;
- versão atualizada para 0.4.0 em `package.json`, `package-lock.json`, `metadata.json`, `src/config/version.ts`, health/runtime e documentação.

### Corrigido — defeitos herdados da 0.3.0

- `server/config/env.ts` deixou de fixar a porta 3000 e passou a ler/validar `process.env.PORT`, mantendo 3000 somente como padrão de desenvolvimento;
- a chave de acompanhamento deixou de trafegar em query string;
- a visão pública deixou de ser construída por `Omit` e não transporta mais `assignedTo`;
- indicadores deixaram de usar uma lista operacional truncada como se representasse o total institucional;
- documentação e matriz de permissões deixaram de mencionar compatibilidade de atribuição por dados livres provenientes da antiga memória.

### Removido

- `server/repositories/inMemoryDatabase.ts`;
- `server/repositories/initialData.ts` do runtime;
- utilitário público baseado em exclusão de campos (`src/utils/publicOccurrence.ts`);
- endpoint legado de acompanhamento `GET /api/occurrences/:protocol` com chave em query string;
- `ENABLE_DEMO_MODE` e o conceito de persistência de ocorrências em memória;
- carga automática de ocorrências demonstrativas no runtime.

### Mantido fora do escopo

- Cloud Storage definitivo, múltiplas fotografias, miniaturas, fotografia de solução e política de retenção;
- Cloud Functions, Trigger Email, SMTP e envio real de e-mail;
- rate limiting definitivo;
- paginação completa, pesquisa textual avançada e filtros escaláveis de alta cardinalidade;
- relatórios avançados, revisão visual geral, revisão WCAG 2.2 AA completa e CI/CD de produção.

### Observação de validação

A validação final desta entrega está registrada em `docs/TESTES_0.4.0.md`, com os comandos efetivamente executados, códigos de saída e limitações do ambiente. Nenhum teste bloqueado por instalação de dependências é tratado como aprovado.

## [0.3.0] — 2026-08-05

### Adicionado

- duas aplicações Firebase nomeadas e independentes para autenticação pública e administrativa;
- Firebase Authentication anônima silenciosa para o fluxo público;
- Google Sign-In administrativo com popup, fallback por redirecionamento e logout real;
- Firebase Admin SDK inicializado de forma idempotente com Application Default Credentials ou emuladores;
- verificação de Firebase ID Token e do provedor de autenticação no backend;
- autorização administrativa pelo Firestore na coleção `adminUsers`;
- vínculo transacional do primeiro UID Firebase ao cadastro previamente autorizado;
- gestão de usuários administrativos por API protegida e interface restrita ao papel Administrador;
- auditoria mínima de login e gestão de acesso na coleção `auditLogs`;
- proteção transacional contra inativação ou rebaixamento do último Administrador ativo;
- matriz efetiva de permissões para Administrador, Gestor e Atendente;
- Firebase App Check com reCAPTCHA Enterprise para produção;
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules` e Firebase Emulator Suite;
- script `firebase:bootstrap-admin` com validação de domínio, dry-run, emulador e proteção contra sobrescrita acidental;
- testes de autenticação, autorização, papéis, App Check, regras, emuladores, interface e políticas estáticas;
- documentação completa de configuração, autenticação, autorização, App Check, emuladores, regras, permissões e primeiro Administrador.

### Alterado

- versão centralizada em `src/config/version.ts` e atualizada para 0.3.0;
- cliente HTTP passou a anexar automaticamente o ID Token correto e o token App Check;
- rotas públicas de registro e acompanhamento passaram a exigir sessão anônima Firebase válida;
- APIs administrativas passaram a exigir Google, e-mail verificado, domínio permitido, cadastro ativo e papel proveniente do servidor;
- atualização de ocorrência passou a filtrar campos por papel e a ignorar papel ou autor declarados pelo cliente;
- Atendente passou a visualizar somente ocorrências atribuídas e não pode alterar prioridade ou responsável;
- runtime passou a declarar Firebase integrado, autenticação anônima, login Google, autorização Firestore e persistência temporária em memória;
- modo demonstrativo passou a se limitar aos dados e à persistência temporária das ocorrências;
- interface de configurações passou a oferecer gestão real de usuários e consulta de auditoria somente ao Administrador;
- `.env.example` e `.gitignore` foram ampliados para configuração por ambiente e exclusão de credenciais, logs e exportações locais.

### Corrigido

- divergência documental da versão 0.2.0: o relatório informava remoção de `bun.lock`, mas o ZIP efetivamente o continha;
- conflito de sessão entre autenticação pública e administrativa por meio de instâncias Firebase e persistências independentes;
- possibilidade de confiar em perfil, papel, nome, departamento ou autor enviados pelo navegador;
- atualização excessiva de `lastAuthorizedLoginAt`, agora limitada à verificação explícita da sessão administrativa;
- inicialização concorrente da autenticação Firebase no frontend, agora protegida por promessa idempotente;
- documentação anterior que descrevia autenticação administrativa demonstrativa como ativa.

### Removido

- `bun.lock`;
- endpoints `/api/auth/demo-users` e `/api/auth/login`;
- `INITIAL_ADMIN_USERS`;
- tokens artificiais com prefixo `demo-`;
- seleção de perfis administrativos simulados;
- armazenamento manual de sessão administrativa no navegador;
- `DemoAdminRoute` e qualquer fallback local de autenticação.

### Mantido fora do escopo

- persistência de ocorrências, protocolos e históricos no Firestore;
- Cloud Storage para fotografias;
- Cloud Functions, Trigger Email, SMTP e notificações reais;
- contador transacional de protocolos, hash persistente da chave e rate limiting definitivo;
- implantação em produção, CI/CD e revisão final WCAG 2.2 AA.

### Observação de validação

A configuração em nuvem permanece pendente de dados institucionais não secretos. A execução de `npm ci` e dos testes dependentes do Firebase CLI deve ser realizada em ambiente cujo registro npm contenha as dependências declaradas. Os resultados efetivos deste ambiente constam em `docs/TESTES_0.3.0.md`.

## [0.2.0] — 2026-08-05

### Adicionado

- identidade pública “Olhos do Campus” e nome administrativo oficial;
- arquivos oficiais horizontal e vertical do IFES — Campus Barra de São Francisco;
- React Router com URLs reais, página não encontrada e preparação de rotas administrativas;
- link de salto, foco no conteúdo após navegação, títulos por rota e melhorias básicas de acessibilidade;
- servidor Express modularizado em controladores, rotas, middlewares, repositório, serviços, tipos, utilitários e validadores;
- rota de saúde em `/api/health`;
- contratos HTTP validados no frontend;
- saneamento defensivo de metadados EXIF, XMP, IPTC e comentários antes da persistência temporária de fotografias;
- validação de entrada com Zod no frontend e backend;
- modo demonstrativo explicitamente configurável e identificado visualmente;
- ESLint, Vitest, ambiente de testes React e testes obrigatórios;
- documentação de identidade, arquitetura, modo demonstrativo, ativos, testes e implementação;
- `package-lock.json` no formato npm lockfile v3.

### Alterado

- TypeScript configurado em modo estrito, com verificações adicionais de nulidade, índices, retornos, parâmetros e variáveis não utilizadas;
- navegação por estado substituída por rotas reais;
- cliente HTTP alterado para preservar erros e validar respostas;
- formulário público reorganizado em seis etapas com terminologia institucional;
- confirmação pública alterada para “Ocorrência registrada”;
- configurações demonstrativas passaram a refletir avisos na página inicial e a denominação institucional no rodapé;
- protocolo normalizado para o formato `INF-AAAA-NNNNNN`;
- indicadores administrativos passaram a ser calculados sobre dados demonstrativos e identificados como tais;
- gerenciamento oficial de dependências migrado para npm.

### Corrigido

- duplicação do ano no protocolo;
- geração e saneamento do prefixo;
- afirmações indevidas sobre envio de e-mail;
- promessas indevidas de anonimato;
- QR Code decorativo removido e substituído por informação explícita de indisponibilidade;
- exposição potencial de observações internas na visão pública;
- fallback silencioso que convertia falhas HTTP em sucesso local;
- divergências terminológicas e de identidade institucional.

### Removido

- lockfile do gerenciador anterior;
- dependências e referências residuais de recursos generativos;
- biblioteca de animação sem uso;
- servidor monolítico original;
- componentes antigos substituídos pela arquitetura modular;
- QR Code meramente visual;
- dados e indicadores fixos apresentados sem identificação demonstrativa.

### Não incluído

- Firebase Authentication, Google Sign-In, Firebase Admin SDK, Firestore, Cloud Storage, App Check, Cloud Functions, Trigger Email, SMTP e implantação de produção.
