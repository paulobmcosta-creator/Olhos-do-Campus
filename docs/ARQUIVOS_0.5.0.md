# Arquivos da versão 0.5.0

Comparação entre o ZIP 0.4.1 recebido como fonte de verdade e o conteúdo final de trabalho da 0.5.0.

- Arquivos na base 0.4.1: **190**
- Arquivos na 0.5.0: **220**
- Arquivos criados: **33**
- Arquivos modificados: **62**
- Arquivos removidos: **3**

## Arquivos criados

- `docs/ARQUIVOS_0.5.0.md`
- `docs/CLOUD_STORAGE_0.5.0.md`
- `docs/INSPECAO_ZIP_FINAL_0.5.0.md`
- `docs/INTEGRACAO_FIREBASE_AI_STUDIO_0.5.0.md`
- `docs/METADADOS_DE_FOTOGRAFIAS.md`
- `docs/POLITICA_DE_FOTOGRAFIAS.md`
- `docs/PROCESSAMENTO_DE_IMAGENS.md`
- `docs/REGRAS_DE_SEGURANCA_0.5.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.5.0.md`
- `docs/SEGURANCA_DO_STORAGE_0.5.0.md`
- `docs/TESTES_0.5.0.md`
- `docs/TRATAMENTO_DE_ARQUIVOS_ORFAOS.md`
- `scripts/storageCleanup.ts`
- `server/middleware/multipartPhotos.ts`
- `server/models/photoDomain.ts`
- `server/repositories/cloudStoragePhotoRepository.ts`
- `server/repositories/photoMetadataRepository.ts`
- `server/repositories/photoRepository.ts`
- `server/repositories/storageCleanupTaskRepository.ts`
- `server/services/imageProcessingService.ts`
- `server/services/photoService.ts`
- `src/components/photos/AdminPhotoGallery.tsx`
- `src/components/photos/PublicSolutionPhotoGallery.tsx`
- `tests/fixtures/photo-with-exif-gps-xmp.jpg`
- `tests/fixtures/photo-with-exif-gps.jpg`
- `tests/helpers/fakePhotoInfrastructure.ts`
- `tests/imageClient.test.ts`
- `tests/imageProcessingService.test.ts`
- `tests/photoApi.test.ts`
- `tests/photoGallery.test.tsx`
- `tests/photoService.test.ts`
- `tests/serverEnvironment.test.ts`
- `tests/storageIntegration.test.ts`

## Arquivos modificados

- `.env.example`
- `CHANGELOG.md`
- `README.md`
- `docs/APP_CHECK.md`
- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/AUTENTICACAO_E_AUTORIZACAO.md`
- `docs/DADOS_DE_REFERENCIA.md`
- `docs/EMULADORES_FIREBASE.md`
- `docs/FIREBASE_CONFIGURACAO.md`
- `docs/FLUXO_DE_SITUACOES.md`
- `docs/HISTORICO_DE_OCORRENCIAS.md`
- `docs/MATRIZ_DE_PERMISSOES.md`
- `docs/MODO_DEMONSTRATIVO.md`
- `docs/PRIMEIRO_ADMINISTRADOR.md`
- `docs/PROTOCOLO_E_CHAVE_DE_ACOMPANHAMENTO.md`
- `firebase-blueprint.json`
- `firestore.rules`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `server/app.ts`
- `server/config/env.ts`
- `server/config/firebaseAdmin.ts`
- `server/config/firebaseRuntime.ts`
- `server/controllers/occurrenceController.ts`
- `server/index.ts`
- `server/repositories/occurrenceRepository.ts`
- `server/routes/apiRoutes.ts`
- `server/serializers/occurrenceDto.ts`
- `server/services/configService.ts`
- `server/services/occurrenceService.ts`
- `server/types/express.d.ts`
- `server/validators/schemas.ts`
- `src/components/common/DemoModeBanner.tsx`
- `src/config/version.ts`
- `src/layouts/RootLayout.tsx`
- `src/models/config.ts`
- `src/models/http.ts`
- `src/models/occurrence.ts`
- `src/pages/HomePage.tsx`
- `src/pages/NewOccurrencePage.tsx`
- `src/pages/TrackingPage.tsx`
- `src/pages/admin/AdminDashboardPage.tsx`
- `src/pages/admin/AdminOccurrenceDetailPage.tsx`
- `src/services/apiClient.ts`
- `src/services/occurrenceService.ts`
- `src/utils/image.ts`
- `src/validators/occurrence.ts`
- `src/validators/responses.ts`
- `storage.rules`
- `tests/apiClient.test.ts`
- `tests/authenticationAuthorizationApi.test.ts`
- `tests/firebaseIntegration.test.ts`
- `tests/firebaseRules.test.ts`
- `tests/firebaseRuntime.test.ts`
- `tests/helpers/fakeRepositories.ts`
- `tests/helpers/occurrenceServiceFixture.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/occurrenceService.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/staticPolicy.test.ts`

## Arquivos removidos

- `server/repositories/temporaryPhotoRepository.ts`
- `server/utils/imageSanitizer.ts`
- `tests/imageSanitizer.test.ts`

## Observação

Documentos históricos de versões anteriores foram preservados quando úteis para rastreabilidade. Eles não definem a versão ativa nem substituem o conteúdo real do código 0.5.0.
