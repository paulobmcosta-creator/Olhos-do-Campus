# Relação de arquivos — versão 0.4.1

Fonte de comparação: ZIP `olhos-do-campus (2).zip`, recebido após o provisionamento Firebase pelo Google AI Studio.

## Resumo

- arquivos criados: **9**;
- arquivos modificados: **41**;
- arquivos removidos: **0**;
- dependências adicionadas: **nenhuma**;
- dependências removidas: **nenhuma**;
- scripts npm adicionados/removidos: **nenhum**.

## Arquivos criados

- `docs/ARQUIVOS_0.4.1.md`
- `docs/INSPECAO_ZIP_FINAL_0.4.1.md`
- `docs/INTEGRACAO_FIREBASE_AI_STUDIO_0.4.1.md`
- `docs/REGRAS_DE_SEGURANCA_0.4.1.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.4.1.md`
- `docs/TESTES_0.4.1.md`
- `firebase.ai-studio.json`
- `server/config/firebaseRuntime.ts`
- `tests/firebaseRuntime.test.ts`

## Arquivos modificados

- `.env.example`
- `.gitignore`
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
- `metadata.json`
- `package-lock.json`
- `package.json`
- `scripts/bootstrapAdmin.ts`
- `scripts/seedDemoData.ts`
- `scripts/seedReferenceData.ts`
- `server/config/env.ts`
- `server/config/firebaseAdmin.ts`
- `server/index.ts`
- `src/config/firebaseEnvironment.ts`
- `src/config/version.ts`
- `src/models/config.ts`
- `src/pages/HomePage.tsx`
- `src/pages/admin/AdminDashboardPage.tsx`
- `src/validators/responses.ts`
- `storage.rules`
- `tests/authenticationAuthorizationApi.test.ts`
- `tests/firebaseIntegration.test.ts`
- `tests/firebaseRules.test.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/occurrenceService.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/staticPolicy.test.ts`

## Arquivos removidos

- Nenhum.

## Dependências

`dependencies` e `devDependencies` permanecem byte-semanticamente equivalentes aos declarados na base 0.4.0 recebida. A alteração do `package-lock.json` limita-se à versão raiz do aplicativo, de 0.4.0 para 0.4.1; não foi introduzida nova biblioteca para a integração.

## Observação sobre arquivos gerenciados pelo AI Studio

`firebase-applet-config.json` já existia na fonte de verdade recebida e foi preservado. Ele contém a configuração pública do Firebase Web App e os identificadores do projeto/banco provisionados pelo AI Studio. O backend 0.4.1 lê desse arquivo somente `projectId` e `firestoreDatabaseId`; nenhuma credencial de serviço é obtida desse arquivo.
