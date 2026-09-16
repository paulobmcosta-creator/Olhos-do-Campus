# Relação de arquivos — versão 0.6.0

Comparação entre a base autorizada `olhos-do-campus-0.5.1 (1).zip` e a árvore destinada à versão 0.6.0. Artefatos transitórios (`node_modules`, `.worklogs`, `dist`, `coverage`, `.vitest`, `.firebase-export`) não integram esta relação nem o ZIP final.

## Resumo

- arquivos criados: **40**;
- arquivos modificados: **74**;
- arquivos removidos: **0**;
- dependências adicionadas: **0**;
- dependências removidas: **0**.

Os únicos scripts npm novos são `firebase:migrate-0.6` e `firebase:seed-campus-spaces`; nenhuma biblioteca foi acrescentada apenas para a 0.6.0.

## Arquivos criados

- `docs/ARQUIVOS_0.6.0.md`
- `docs/AUDITORIA_OPERACIONAL_0.6.0.md`
- `docs/CALENDARIO_DE_ATENDIMENTO.md`
- `docs/CATEGORIAS_E_RECLASSIFICACAO.md`
- `docs/EQUIPES_RESPONSAVEIS.md`
- `docs/EXPORTACOES_0.6.0.md`
- `docs/INDICADORES_0.6.0.md`
- `docs/INSPECAO_ZIP_FINAL_0.6.0.md`
- `docs/LOCAIS_E_CORRECAO_DE_LOCAL.md`
- `docs/MATRIZ_DE_PERMISSOES_0.6.0.md`
- `docs/MIGRACAO_0.5.1_PARA_0.6.0.md`
- `docs/MIGRACAO_0.5.2_PARA_0.6.0.md`
- `docs/PAINEL_ADMINISTRATIVO_0.6.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.6.0.md`
- `docs/SLA_0.6.0.md`
- `docs/TESTES_0.6.0.md`
- `scripts/migrate060.ts`
- `scripts/seedCampusSpaces.ts`
- `server/controllers/operationalAdminController.ts`
- `server/domain/businessTime.ts`
- `server/domain/sla.ts`
- `server/repositories/operationalTeamRepository.ts`
- `server/repositories/slaConfigRepository.ts`
- `server/services/operationalAdminService.ts`
- `server/utils/reportExport.ts`
- `src/models/operations.ts`
- `src/pages/admin/AdminAnalyticsPage.tsx`
- `src/pages/admin/AdminAuditPage.tsx`
- `src/pages/admin/AdminTeamsPage.tsx`
- `src/pages/admin/AdminUsersPage.tsx`
- `src/services/operationsService.ts`
- `src/utils/polling.ts`
- `tests/adminRoles060.test.ts`
- `tests/analytics060.test.ts`
- `tests/internalNoteAudience060.test.ts`
- `tests/operationalAdministration060.test.ts`
- `tests/pagination060.test.ts`
- `tests/polling060.test.ts`
- `tests/reportExport060.test.ts`
- `tests/sla060.test.ts`

## Arquivos modificados

- `CHANGELOG.md`
- `README.md`
- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/AUTENTICACAO_E_AUTORIZACAO.md`
- `docs/DADOS_DE_REFERENCIA.md`
- `docs/EMULADORES_FIREBASE.md`
- `docs/FIREBASE_CONFIGURACAO.md`
- `docs/FLUXO_DE_SITUACOES.md`
- `docs/MATRIZ_DE_PERMISSOES.md`
- `docs/POLITICA_DE_FOTOGRAFIAS.md`
- `firebase-blueprint.json`
- `firestore.indexes.json`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `scripts/seedDemoData.ts`
- `scripts/seedReferenceData.ts`
- `server/app.ts`
- `server/controllers/adminUserController.ts`
- `server/models/occurrenceDomain.ts`
- `server/repositories/adminUserRepository.ts`
- `server/repositories/auditLogRepository.ts`
- `server/repositories/categoryRepository.ts`
- `server/repositories/locationRepository.ts`
- `server/repositories/occurrenceEventRepository.ts`
- `server/repositories/occurrenceRepository.ts`
- `server/repositories/referenceSeedData.ts`
- `server/routes/apiRoutes.ts`
- `server/serializers/occurrenceDto.ts`
- `server/services/adminAuthorizationService.ts`
- `server/services/adminUserService.ts`
- `server/services/occurrenceService.ts`
- `server/validators/schemas.ts`
- `src/components/admin/AdminUserManagement.tsx`
- `src/components/common/OccurrenceBadges.tsx`
- `src/config/routes.ts`
- `src/config/version.ts`
- `src/layouts/AdminLayout.tsx`
- `src/models/admin.ts`
- `src/models/config.ts`
- `src/models/http.ts`
- `src/models/occurrence.ts`
- `src/pages/HomePage.tsx`
- `src/pages/NewOccurrencePage.tsx`
- `src/pages/TrackingPage.tsx`
- `src/pages/admin/AdminDashboardPage.tsx`
- `src/pages/admin/AdminOccurrenceDetailPage.tsx`
- `src/pages/admin/AdminOccurrencesPage.tsx`
- `src/pages/admin/AdminSettingsPage.tsx`
- `src/routes/AppRouter.tsx`
- `src/services/adminService.ts`
- `src/services/apiClient.ts`
- `src/validators/responses.ts`
- `tests/adminAuthorization.test.ts`
- `tests/adminUserRepository.test.ts`
- `tests/authenticationAuthorizationApi.test.ts`
- `tests/firebaseIntegration.test.ts`
- `tests/firebaseRuntime.test.ts`
- `tests/firestoreSerialization.test.ts`
- `tests/helpers/fakePhotoInfrastructure.ts`
- `tests/helpers/fakeRepositories.ts`
- `tests/helpers/occurrenceServiceFixture.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/occurrenceDomainRules.test.ts`
- `tests/occurrencePermissions.test.ts`
- `tests/occurrenceService.test.ts`
- `tests/occurrenceStateMachine.test.ts`
- `tests/photoApi.test.ts`
- `tests/photoGallery.test.tsx`
- `tests/publicOccurrence.test.ts`
- `tests/referenceData.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/staticPolicy.test.ts`

## Arquivos removidos

Nenhum arquivo da base 0.5.1 foi removido.

## Observação sobre documentos históricos

Documentos numerados de versões anteriores permanecem no projeto como registro histórico. Eles não substituem README, matriz de permissões, arquitetura, dados de referência e documentação específica da 0.6.0.
