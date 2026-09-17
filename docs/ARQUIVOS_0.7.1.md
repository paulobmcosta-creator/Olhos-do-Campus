# Arquivos da versão 0.7.1

Comparação direta entre a árvore extraída de `olhos-do-campus-0.7.0.zip` e a árvore final 0.7.1, excluindo artefatos regeneráveis (`node_modules`, `dist`) e o repositório Git temporário usado apenas para comparação local.

## Criados — 15

- `docs/ARQUIVOS_0.7.1.md`;
- `docs/ARTIFACT_REGISTRY_0.7.1.md`;
- `docs/CLOUDFLARE_R2_0.7.1.md`;
- `docs/HOMOLOGACAO_MANUAL_0.7.1.md`;
- `docs/IMPLANTACAO_0.7.1.md`;
- `docs/INFRAESTRUTURA_CAPACIDADE_0.7.1.md`;
- `docs/INSPECAO_ZIP_FINAL_0.7.1.md`;
- `docs/RELATORIO_IMPLEMENTACAO_0.7.1.md`;
- `docs/RESEND_0.7.1.md`;
- `docs/TESTES_0.7.1.md`;
- `scripts/storageMigrationVerification.ts`;
- `server/domain/notificationDeliveryState.ts`;
- `tests/fallbackDeletion071.test.ts`;
- `tests/notificationDelivery071.test.ts`;
- `tests/preDeployment071.test.ts`.

## Modificados — 31

- `CHANGELOG.md`;
- `Dockerfile`;
- `README.md`;
- `cloudbuild.yaml`;
- `firebase-blueprint.json`;
- `infra/artifact-registry-cleanup-policy.json`;
- `infra/cloudflare/maintenance-worker/package-lock.json`;
- `infra/cloudflare/maintenance-worker/package.json`;
- `infra/cloudflare/maintenance-worker/src/index.ts`;
- `metadata.json`;
- `package-lock.json`;
- `package.json`;
- `scripts/migrateStorageToR2.ts`;
- `server/models/notificationDomain.ts`;
- `server/providers/emailProvider.ts`;
- `server/providers/resendEmailProvider.ts`;
- `server/repositories/fallbackPhotoRepository.ts`;
- `server/repositories/infrastructureRepository.ts`;
- `server/repositories/notificationOutboxRepository.ts`;
- `server/repositories/photoRepository.ts`;
- `server/services/infrastructureService.ts`;
- `server/services/notificationService.ts`;
- `server/services/photoService.ts`;
- `src/components/admin/NotificationSettingsPanel.tsx`;
- `src/config/version.ts`;
- `src/models/infrastructure.ts`;
- `src/pages/admin/AdminInfrastructurePage.tsx`;
- `src/validators/responses.ts`;
- `tests/bootstrapContractVersion062.test.ts`;
- `tests/infrastructure070.test.ts`;
- `tests/notificationOutbox070.test.ts`.

## Removidos — 0

Nenhum arquivo-fonte da versão 0.7.0 foi removido.

A remoção do vínculo local `olhos-do-campus: file:../../..` ocorre apenas dentro dos metadados do `package.json`/`package-lock.json` do Worker; não representa remoção de arquivo-fonte.

## Preservação deliberada

- documentos de versões anteriores permanecem históricos e não foram renumerados;
- identificadores históricos como `seed-0.7.0` permanecem quando representam proveniência real;
- `node_modules` e `dist` não entram no ZIP final e não contam como remoção de fonte;
- não houve alteração de versão nas dependências reais travadas pelos lockfiles.
