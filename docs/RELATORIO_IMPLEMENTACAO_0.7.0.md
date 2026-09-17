# Relatório de implementação — versão 0.7.0

## 1. Base, inspeção e premissas

O diretório de trabalho estava vazio no início. Por isso, o ZIP fornecido `olhos-do-campus (1).zip` foi aberto integralmente no próprio diretório e sua versão 0.6.2 passou a ser a fonte de verdade. Antes das alterações foram lidos código, testes, `package.json`, lockfile, ambiente, Firebase, regras e documentação ativa.

Premissas validadas:

- a persistência ativa era Firestore e o backend já concentrava autenticação/autorização;
- `OccurrenceRepository.createWithProtocol` já usava transação para protocolo, ocorrência, eventos e metadata de fotos, permitindo estender a mesma transação à outbox;
- `SystemConfig` já possuía `notificationEmails`, mas a UI ainda declarava e-mail real fora de escopo;
- fotografias produtivas ainda usavam Firebase Storage via repository server-only;
- o servidor servia Vite em desenvolvimento e arquivos estáticos em produção;
- regras Firestore/Storage eram deny-all;
- `firebase-applet-config.json` do ZIP estava vazio, apesar de contratos e documentação exigirem JSON válido; ele foi restaurado somente com os identificadores públicos já documentados, sem inventar API key Web.

Baseline: instalação e typecheck passaram; lint e 9 testes existentes falharam por problemas já presentes (config vazio, parser ESLint, contrato JSON/multipart, mensagem de conflito, seleção de foto, spawn Windows e blueprint). As correções necessárias foram incorporadas sem alterar o domínio fora do escopo.

## 2. Resend e outbox

### Objetivo

Enviar notificação institucional de nova ocorrência REAL, com privacidade, atomicidade, idempotência e operação concorrente segura.

### Implementação

Provider Resend server-only; outbox Firestore determinística; uma entrega por destinatário; criação atômica com ocorrência/eventos/fotos; claim transacional com lease; oito tentativas com backoff; estados de quota, falha, supressão e entrega; webhook raw assinado/deduplicado; teste administrativo e retry auditados; painel de configuração/status.

### Arquivos principais

`server/domain/notificationOutbox.ts`, `server/models/notificationDomain.ts`, `server/providers/*`, `server/repositories/notificationOutboxRepository.ts`, `server/services/notificationService.ts`, `server/controllers/notificationController.ts`, `src/components/admin/NotificationSettingsPanel.tsx` e integrações em occurrence/config/routes.

### Modelo de dados

`notificationOutbox/{hash}` contém somente identidade do evento, entidade/protocolo, destinatário, hash, status, tentativas, provider/message ID, idempotency key, dados mínimos de template, timestamps e lease. `notificationWebhookEvents/{eventId}` guarda metadados mínimos para deduplicação. Não guarda corpo bruto.

### Segurança

Sem chave/descrição/foto/IP/tokens no e-mail; destinatários separados; credenciais somente no backend; mensagens de erro sanitizam e-mail e padrões de chave; webhook validado com corpo bruto. `delivery_delayed` mantém `SENT` para não reenviar mensagem já aceita.

### Compatibilidade

`emailNotificationsEnabled=false` mantém envio desligado. Quando a configuração administrativa está habilitada, a outbox é criada mesmo se o provider estiver temporariamente indisponível; o envio só ocorre com `RESEND_ENABLED=true` e chave administrativa ativa. TEST não gera notificação de ocorrência.

### Testes

Determinismo, duplicidade, múltiplos destinatários, lease, classificação de erros, quota, configuração ausente, REAL/TEST, flag desabilitada, teste/retry, webhook válido/inválido/duplicado, delivered/bounced/complained/delayed e minimização de payload.

### Limitações e pendências externas

Conta, DNS, API key, remetente, webhook e secrets Resend não foram configurados. O SDK usado não expõe quota em headers; o painel mostra contadores lógicos e referências, orientando consulta ao provedor.

## 3. Cloudflare R2

### Objetivo

Usar R2 privado como armazenamento produtivo, preservando processamento e disponibilidade durante migração.

### Implementação

Repository S3 compatível com path estrito, upload/read/head/delete/list paginado, metadata e headers privados; fallback legado somente na leitura; cleanup generalizado por provider; migração dry-run/apply/verify; remoção da origem em operação separada de duas passagens; reconciliação paginada com limite, inventário completo e janela de segurança.

### Arquivos principais

`server/repositories/r2PhotoRepository.ts`, `fallbackPhotoRepository.ts`, repositories/services de fotografia, `scripts/migrateStorageToR2.ts`, `reconcilePhotoStorage.ts` e `storageCleanup.ts`.

### Modelo de dados

Bytes no R2; Firestore mantém metadata `occurrences/{id}/photos/{photoId}`. `storageCleanupTasks` ganhou `storageProvider`; relatório agregado de reconciliação fica em `storageReconciliationReports/latest`.

### Segurança

Bucket privado, credenciais server-only, paths allowlist, sem URL pública, compensação antes de metadata READY e nenhuma exclusão de órfão com inventário incompleto/objeto recente.

### Compatibilidade

Produção exige R2. Storage Emulator permanece local. Fallback Firebase real é opt-in e temporário; novas gravações nunca retornam ao legado.

### Testes

Fake S3 cobre path, CRUD, metadata, inexistência, erro, compensação, fallback, reconciliação, órfãos, dry-run e proteção recente. Cleanup persistente continua coberto pela suíte de fotografias.

### Limitações e pendências externas

Mecanismo de migração implementado e testado localmente/unitariamente; migração dos objetos de produção não executada por ausência de acesso ao ambiente externo.

## 4. Cloudflare Pages, Cloud Run e CORS

### Objetivo

Separar frontend estático e API, mantendo Auth/App Check em origens distintas.

### Implementação

Builds `build:pages` e `build:server`; Pages em `dist/client`; servidor em `dist/server`; fallback SPA; headers de segurança; `VITE_API_BASE_URL` HTTPS obrigatório em produção; CORS com allowlist, preflight, headers necessários, `Vary: Origin` e sem credentials; Cloud Run API only; Dockerfile e Cloud Build para imagem da API.

### Arquivos principais

`vite.config.ts`, `src/config/env.ts`, `public/_redirects`, `public/_headers`, `server/middleware/cors.ts`, `server/index.ts`, `Dockerfile` e `cloudbuild.yaml`.

### Modelo de dados

Sem alteração de dados. Configurações `VITE_*` são públicas; secrets nunca têm esse prefixo.

### Segurança

Wildcard proibido; produção exige HTTPS e App Check; CSP estática foi deliberadamente não criada porque as origens reais de Firebase/Google/reCAPTCHA/API dependem da implantação e uma política teórica quebraria o fluxo. O runbook exige derivação e teste antes de futura CSP.

### Compatibilidade

Vite middleware é preservado somente em desenvolvimento. Configuração Firebase pública/AI Studio continua disponível para Auth/App Check; `storageBucket` não define o provider produtivo.

### Testes

API base, CORS permitido/negado, preflight, Authorization/App Check, fallback SPA e ausência de static serving em produção.

### Limitações e pendências externas

Pages e Cloud Run não foram publicados; domínios autorizados e origens finais ainda devem ser configurados.

## 5. Infraestrutura e capacidade

### Objetivo

Dar ao Administrador visibilidade longitudinal e agregada antes de incidentes de capacidade.

### Implementação

Página exclusiva do Administrador com R2, Firestore, Resend, cleanup, reconciliação e Artifact Registry; referências configuráveis; níveis textuais; histórico 30/90/365; SVG com tabela; crescimento/projeções; alertas no dashboard; snapshot diário idempotente, rollup mensal e limpeza técnica após rollup.

Firestore usa aggregation count. Armazenamento lógico continua “não medido” até ação explícita; essa ação faz amostragem paginada de até 5.000 documentos, registra método, amostra e cobertura, sem scan periódico.

### Arquivos principais

`src/models/infrastructure.ts`, `server/repositories/infrastructureRepository.ts`, `server/services/infrastructureService.ts`, controller/routes, frontend service/schema e `AdminInfrastructurePage.tsx`.

### Modelo de dados

`infrastructureCapacitySettings/default`, `infrastructureUsageSnapshots/daily-*` e `monthly-*`, `storageReconciliationReports/latest` e `artifactRegistrySnapshots`. Snapshots têm somente agregados.

### Segurança

API e UI exclusivas do Administrador; Gestor recebe 403; ações auditadas; nenhum conteúdo de ocorrência, chave, foto, IP, token ou secret em snapshots.

### Compatibilidade

Dashboard operacional e permissões do Gestor foram preservados. Limiares apenas alertam e não bloqueiam nem apagam dados.

### Testes

Snapshots, histórico, ausência/presença antiga de Artifact, estimativa explícita, limites, projeções, crescimento zero, thresholds, privacidade e autorização.

### Limitações e pendências externas

Estimativa Firestore não inclui índices/overhead e não é faturamento. Projeções exigem histórico suficiente. Referências devem ser revistas quando contratos/provedores mudarem.

## 6. Worker e Artifact Registry

### Objetivo

Agendar manutenção sem Cloud Functions e controlar crescimento do registro de imagens sem ampliar permissão do Cloud Run.

### Implementação

Worker isolado com cron separado para notificações e snapshot diário; HMAC SHA-256 de método/path/timestamp, comparação constante e janela de cinco minutos. Policy do Artifact Registry remove untagged antigos e preserva 10 recentes; script de apply exige confirmação. Snapshot externo agrega bytes/versões no Firestore.

### Arquivos principais

`infra/cloudflare/maintenance-worker/*`, `server/middleware/requireMaintenanceSignature.ts`, `infra/artifact-registry-cleanup-policy.json` e scripts Artifact.

### Modelo de dados

Worker não acessa Firebase/R2/Resend. Artifact grava somente observação agregada.

### Segurança

Secret apenas no Worker/Cloud Run, sem header estático puro; nenhum secret/assinatura/IP persistido. Apply do cleanup tem dry-run e confirmação inequívoca.

### Compatibilidade

Manutenção manual pelo Administrador permanece disponível se o Worker parar. Artifact Registry continua sendo o registry atual.

### Testes

HMAC, timestamp/replay, assinatura/path/secret inválidos, seleção de endpoint e typecheck próprio.

### Limitações e pendências externas

Worker, cron, secrets, snapshot Artifact e cleanup policy não foram publicados/aplicados.

## 7. Versão, segurança e preservação

Versão ativa 0.7.0 em package/lock, constante, bootstrap, metadata, blueprint, páginas e contratos. Regras deny-all preservadas e estendidas em testes. Nenhum serviço pago adicional, deploy, migração, envio ou recurso externo foi criado. Funcionalidades 0.6.2 de SLA, equipes, filtros, exports, auditoria, polling, fotos e expurgo TEST foram mantidas.

## 8. Riscos residuais

- bundle principal do Pages ficou em aproximadamente 684 kB minificado (176 kB gzip); é aviso de performance, sem biblioteca de gráfico adicionada;
- Firebase Emulator Suite não pôde ser iniciado neste host por ausência de Java;
- integrações reais dependem de credenciais, DNS, domínios, permissões e homologação manual;
- rotação HMAC usa janela coordenada de um secret ativo;
- política futura de retenção de dados REAL continua exigindo decisão institucional formal.

