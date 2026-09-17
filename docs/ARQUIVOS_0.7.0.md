# Arquivos da versão 0.7.0

Comparação por SHA-256 entre a extração original 0.6.2 e a árvore 0.7.0, excluindo `node_modules`, `dist`, `work` e `outputs`.

## Criados

- infraestrutura de build: `.dockerignore`, `Dockerfile`, `cloudbuild.yaml`;
- Pages: `public/_headers`, `public/_redirects`;
- Worker: `infra/cloudflare/maintenance-worker/package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.jsonc`, `src/index.ts`, `src/maintenance.ts`, `src/signature.ts`;
- Artifact: `infra/artifact-registry-cleanup-policy.json`, `scripts/artifactRegistryCleanup.ts`, `scripts/artifactRegistrySnapshot.ts`;
- R2: `server/repositories/r2PhotoRepository.ts`, `fallbackPhotoRepository.ts`, `scripts/migrateStorageToR2.ts`, `scripts/reconcilePhotoStorage.ts`;
- notificações: `server/models/notificationDomain.ts`, `server/domain/notificationOutbox.ts`, `server/providers/emailProvider.ts`, `server/providers/resendEmailProvider.ts`, `server/repositories/notificationOutboxRepository.ts`, `server/services/notificationService.ts`, `server/controllers/notificationController.ts`, `src/services/notificationService.ts`, `src/components/admin/NotificationSettingsPanel.tsx`;
- infraestrutura/capacidade: `server/repositories/infrastructureRepository.ts`, `server/services/infrastructureService.ts`, `server/controllers/infrastructureController.ts`, `src/models/infrastructure.ts`, `src/services/infrastructureService.ts`, `src/pages/admin/AdminInfrastructurePage.tsx`;
- segurança HTTP: `server/middleware/cors.ts`, `server/middleware/requireMaintenanceSignature.ts`;
- testes: `tests/notificationOutbox070.test.ts`, `r2Storage070.test.ts`, `r2Integration.optIn.test.ts`, `resendIntegration.optIn.test.ts`, `pagesCors070.test.ts`, `infrastructure070.test.ts`, `maintenanceWorker070.test.ts`, `maintenanceSignatureApi070.test.ts`;
- documentação: `docs/ARTIFACT_REGISTRY_0.7.0.md`, `CLOUDFLARE_PAGES_0.7.0.md`, `CLOUDFLARE_R2_0.7.0.md`, `HOMOLOGACAO_MANUAL_0.7.0.md`, `IMPLANTACAO_0.7.0.md`, `INFRAESTRUTURA_CAPACIDADE_0.7.0.md`, `MAINTENANCE_WORKER_0.7.0.md`, `RESEND_0.7.0.md`, `RELATORIO_IMPLEMENTACAO_0.7.0.md`, `TESTES_0.7.0.md`, `ARQUIVOS_0.7.0.md`, `INSPECAO_ZIP_FINAL_0.7.0.md`.

## Modificados

`.env.example`, `CHANGELOG.md`, `README.md`, `eslint.config.js`, `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.indexes.json`, `firestore.rules`, `metadata.json`, `package.json`, `package-lock.json`, `vitest.config.ts`.

Documentação ativa: `docs/APP_CHECK.md`, `ARQUITETURA.md`, `ARVORE_DIRETORIOS.md`, `MATRIZ_DE_PERMISSOES.md`, `MATRIZ_DE_PERMISSOES_0.6.0.md`, `MODO_DEMONSTRATIVO.md`, `PAINEL_ADMINISTRATIVO_0.6.0.md`, `POLITICA_DE_FOTOGRAFIAS.md`, `TRATAMENTO_DE_ARQUIVOS_ORFAOS.md`.

Backend/scripts: `scripts/prepareProductionPackage.mjs`, `scripts/storageCleanup.ts`, `server/app.ts`, `server/index.ts`, configurações Firebase/ambiente, modelos/repositories/services de foto, ocorrência, config e admin, `server/routes/apiRoutes.ts` e `server/validators/schemas.ts`.

Frontend: `src/config/env.ts`, `routes.ts`, `version.ts`, `src/layouts/AdminLayout.tsx`, modelos admin/config/http, dashboard/configurações/home/router, `src/services/apiClient.ts` e schemas de resposta.

Testes preservados/adaptados: autenticação/autorização, bootstrap, integração/regras Firebase, runtime Firebase, helpers, API de fotos, empacotamento, branding/rotas e integração Storage.

## Removidos

Nenhum arquivo-fonte da versão 0.6.2 foi removido. `node_modules` e `dist` são artefatos regeneráveis e não entram no ZIP final; isso não conta como remoção de fonte.

