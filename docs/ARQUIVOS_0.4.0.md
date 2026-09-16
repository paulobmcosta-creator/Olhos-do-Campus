# Relação de arquivos — versão 0.4.0

Comparação realizada entre o ZIP-fonte 0.3.0 efetivamente recebido e a árvore candidata 0.4.0, excluindo artefatos locais (`node_modules`, `dist`, caches e exportações de emuladores).

## Arquivos criados

Total: **32**.

- `docs/ARQUIVOS_0.4.0.md`
- `docs/DADOS_DE_REFERENCIA.md`
- `docs/FLUXO_DE_SITUACOES.md`
- `docs/HISTORICO_DE_OCORRENCIAS.md`
- `docs/INSPECAO_ZIP_FINAL_0.4.0.md`
- `docs/MIGRACAO_MEMORIA_PARA_FIRESTORE.md`
- `docs/MODELO_DE_DADOS_FIRESTORE_0.4.0.md`
- `docs/PROTOCOLO_E_CHAVE_DE_ACOMPANHAMENTO.md`
- `docs/REGRAS_DE_SEGURANCA_0.4.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.4.0.md`
- `docs/TESTES_0.4.0.md`
- `scripts/seedDemoData.ts`
- `scripts/seedReferenceData.ts`
- `server/config/port.ts`
- `server/domain/occurrenceStateMachine.ts`
- `server/models/occurrenceDomain.ts`
- `server/repositories/categoryRepository.ts`
- `server/repositories/locationRepository.ts`
- `server/repositories/occurrenceEventRepository.ts`
- `server/repositories/occurrenceRepository.ts`
- `server/repositories/protocolCounterRepository.ts`
- `server/repositories/referenceSeedData.ts`
- `server/repositories/systemConfigRepository.ts`
- `server/repositories/temporaryPhotoRepository.ts`
- `server/serializers/occurrenceDto.ts`
- `tests/firestoreSerialization.test.ts`
- `tests/helpers/fakeRepositories.ts`
- `tests/helpers/occurrenceServiceFixture.ts`
- `tests/occurrenceDomainRules.test.ts`
- `tests/occurrenceStateMachine.test.ts`
- `tests/referenceData.test.ts`
- `tests/trackingKey.test.ts`

## Arquivos modificados

Total: **60**.

- `.env.example`
- `CHANGELOG.md`
- `README.md`
- `docs/APP_CHECK.md`
- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/AUTENTICACAO_E_AUTORIZACAO.md`
- `docs/EMULADORES_FIREBASE.md`
- `docs/FIREBASE_CONFIGURACAO.md`
- `docs/MATRIZ_DE_PERMISSOES.md`
- `docs/MODO_DEMONSTRATIVO.md`
- `docs/PRIMEIRO_ADMINISTRADOR.md`
- `docs/REGRAS_DE_SEGURANCA_0.3.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.2.0.md`
- `firestore.indexes.json`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `server/app.ts`
- `server/config/env.ts`
- `server/controllers/configController.ts`
- `server/controllers/occurrenceController.ts`
- `server/index.ts`
- `server/routes/apiRoutes.ts`
- `server/services/configService.ts`
- `server/services/occurrenceService.ts`
- `server/utils/trackingKey.ts`
- `server/validators/schemas.ts`
- `src/components/common/DemoModeBanner.tsx`
- `src/components/common/Footer.tsx`
- `src/config/version.ts`
- `src/layouts/RootLayout.tsx`
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
- `src/services/apiClient.ts`
- `src/services/configService.ts`
- `src/services/occurrenceService.ts`
- `src/validators/occurrence.ts`
- `src/validators/responses.ts`
- `src/validators/tracking.ts`
- `storage.rules`
- `tests/authenticationAuthorizationApi.test.ts`
- `tests/firebaseIntegration.test.ts`
- `tests/firebaseRules.test.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/occurrencePermissions.test.ts`
- `tests/occurrenceService.test.ts`
- `tests/publicOccurrence.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/staticPolicy.test.ts`
- `tests/validation.test.ts`

## Arquivos removidos

Total: **3**.

- `server/repositories/inMemoryDatabase.ts`
- `server/repositories/initialData.ts`
- `src/utils/publicOccurrence.ts`

## Dependências

- Dependências adicionadas: **nenhuma**.
- Dependências removidas: **nenhuma**.
- `package-lock.json`: grafo preservado; versão raiz atualizada para 0.4.0.
