# Arquitetura — versão 0.7.0

## Visão geral

```text
Navegador
  -> Cloudflare Pages: React/TypeScript/Vite
  -> Firebase Authentication + App Check
  -> HTTPS/CORS
Cloud Run: Express API only
  -> domínio/services/repositories
  -> Cloud Firestore: ocorrências, histórico, metadados, outbox e snapshots
  -> Cloudflare R2 privado: bytes das fotografias
  -> Resend: entrega de e-mail

Cloudflare Maintenance Worker
  -> HMAC + janela temporal
  -> processamento periódico da outbox e snapshot agregado
```

Pages e Cloud Run possuem builds separados. Em produção, Express responde apenas `/api`; não serve `dist/client`, assets ou fallback SPA. Pages usa `_redirects` para a SPA e `_headers` para headers compatíveis. CORS exige lista de origens HTTPS exatas.

## Identidade, dados e autorização

O registro/acompanhamento público usa Firebase Anonymous Auth; administração usa Google Sign-In, e-mail verificado, domínio permitido e allowlist `adminUsers`. App Check atesta o cliente. Toda autorização crítica é aplicada no backend.

O cliente não acessa Firestore, Firebase Storage nem R2 diretamente. Regras Firestore/Storage são deny-all. O Firebase Admin SDK continua necessário para Auth, Firestore e testes/fallback Storage, mesmo que os bytes produtivos estejam no R2.

Coleções principais:

- `occurrences/{id}` com `events` e `photos`;
- `notificationOutbox` e `notificationWebhookEvents`;
- `infrastructureCapacitySettings` e `infrastructureUsageSnapshots` (documentos `daily-*` e agregados `monthly-*`);
- `artifactRegistrySnapshots` e `storageReconciliationReports`;
- `storageCleanupTasks`;
- `adminUsers`, `auditLogs`, `categories`, `locations`, `operationalTeams`, `systemSettings`, SLA/calendário e contadores.

Novas coleções técnicas permanecem server-only. Snapshots contêm somente agregados e não copiam ocorrências, e-mails, chaves ou IPs.

## Ocorrências e outbox

A criação reserva protocolo e, na mesma transação Firestore, grava ocorrência, evento inicial, metadados de fotos e itens determinísticos da outbox para dados `REAL`. Falha transacional não deixa ocorrência sem os itens previstos. Dados `TEST` não geram entrega real.

Cada documento da outbox representa um destinatário. Claims transacionais com lease suportam instâncias concorrentes do Cloud Run. Retry usa backoff e estados explícitos; o documento e a `Idempotency-Key` do Resend formam duas camadas de idempotência. Webhooks assinados atualizam delivered/bounced/complained e são deduplicados.

## Fotografias

O navegador envia multipart à API. `sharp` valida assinatura binária, limita tipo/quantidade/tamanho, reencoda JPEG/PNG/WebP para WebP, remove metadados e gera thumbnail. O R2 guarda os bytes; Firestore guarda existência lógica, path, hash, tamanho, visibilidade e estado.

Falha parcial tenta compensação idempotente. Falha da compensação registra `storageCleanupTasks`. Migração e reconciliação são paginadas, dry-run por padrão e não estabelecem retenção automática para dados `REAL`. Firebase Storage é somente origem legada/fallback temporário e backend local do emulador.

## Infraestrutura

O painel exclusivo do Administrador combina inventário R2, contagem/estimativa Firestore, métricas da outbox, cleanup, reconciliação e último snapshot externo do Artifact Registry. Referências e limiares são configuráveis e produzem alertas, nunca bloqueio ou exclusão automática. Projeções são marcadas como estimativas.

O Artifact Registry é observado por script com identidade operacional própria, evitando conceder leitura do Registry ao Cloud Run. O Worker agenda somente endpoints internos assinados; a manutenção manual continua disponível.

## Segurança preservada

- protocolo + chave de acompanhamento fora da URL;
- hash + salt, sem chave em texto puro;
- optimistic locking e eventos de domínio;
- fotografias iniciais internas;
- logs e e-mails minimizados;
- exclusão física comum somente para dados `TEST` por Administrador;
- nenhuma Cloud Function, Cloud Tasks, Pub/Sub, Billing API ou banco adicional;
- nenhum segredo no frontend.
