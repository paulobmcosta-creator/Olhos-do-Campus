# Arquivos da versão 0.7.3

Comparação por SHA-256 entre a fonte de verdade 0.7.2 e a árvore final 0.7.3, excluindo somente artefatos regeneráveis/locais (`node_modules`, `dist`, `work`, `outputs`, `.git`, `.env` real, logs e temporários).

## Criados — 8

- `docs/ARQUIVOS_0.7.3.md`
- `docs/HOMOLOGACAO_MANUAL_0.7.3.md`
- `docs/INFRAESTRUTURA_CAPACIDADE_0.7.3.md`
- `docs/INSPECAO_ZIP_FINAL_0.7.3.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.7.3.md`
- `docs/RESEND_0.7.3.md`
- `docs/TESTES_0.7.3.md`
- `tests/notificationAttempts073.test.ts`

## Modificados — 29

- `CHANGELOG.md`
- `README.md`
- `firebase-blueprint.json`
- `firestore.indexes.json`
- `firestore.rules`
- `infra/cloudflare/maintenance-worker/package-lock.json`
- `infra/cloudflare/maintenance-worker/package.json`
- `infra/cloudflare/maintenance-worker/src/index.ts`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `server/domain/notificationDeliveryState.ts`
- `server/domain/notificationOutbox.ts`
- `server/models/notificationDomain.ts`
- `server/providers/emailProvider.ts`
- `server/providers/resendEmailProvider.ts`
- `server/repositories/infrastructureRepository.ts`
- `server/repositories/notificationOutboxRepository.ts`
- `server/services/notificationService.ts`
- `src/config/version.ts`
- `src/models/infrastructure.ts`
- `src/pages/admin/AdminInfrastructurePage.tsx`
- `src/validators/responses.ts`
- `tests/bootstrapContractVersion062.test.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/infrastructure070.test.ts`
- `tests/notificationCorrelation072.test.ts`
- `tests/preDeployment071.test.ts`
- `tests/resendIntegration.optIn.test.ts`

## Removidos — 0

Nenhum arquivo-fonte/documental da versão 0.7.2 foi removido.

## Síntese

- a alteração funcional está concentrada no subsistema de notificações attempt-aware, métricas relacionadas, índices necessários, testes, versionamento e documentação;
- R2, migração/verify, fallback Storage, reconciliação R2, Artifact Registry cleanup, Cloud Build, Docker e arquivos Pages foram preservados sem alteração;
- nenhum serviço novo foi introduzido;
- a subcoleção `notificationOutbox/{notificationId}/attempts/{attemptId}` é server-only pelas regras deny-all já existentes;
- `node_modules` e `dist` não integram o ZIP final e não contam como remoção de fonte.
