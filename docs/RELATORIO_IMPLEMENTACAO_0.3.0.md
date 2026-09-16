# Relatório de implementação — versão 0.3.0

## 1. Identificação

- **Projeto:** Olhos do Campus.
- **Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física.
- **Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco.
- **Versão:** 0.3.0.
- **Data:** 5 de agosto de 2026.
- **Fonte de verdade:** ZIP `olhos-do-campus(1).zip` anexado à solicitação.

## 2. Inspeção prévia

O ZIP foi extraído e sua estrutura, configuração, frontend, backend, testes e documentação foram inspecionados antes das alterações. Foi confirmada a divergência conhecida: `docs/RELATORIO_IMPLEMENTACAO_0.2.0.md` declarava que `bun.lock` havia sido removido, mas o arquivo estava presente no ZIP. O arquivo foi removido e npm permanece como único gerenciador oficial.

A inspeção também localizou autenticação administrativa demonstrativa baseada em endpoints de login, perfis iniciais, tokens artificiais e armazenamento manual de sessão. Esses mecanismos foram integralmente removidos.

Não foram localizados arquivos `.env` reais, private keys, arquivos de service account ou credenciais versionadas no ZIP de entrada.

## 3. Resumo executivo

A versão 0.3.0 estabelece a fundação Firebase para identidade e autorização, sem antecipar a migração das ocorrências. O frontend passou a usar duas aplicações Firebase nomeadas e independentes. O backend valida ID Tokens, App Check, provedor Google, e-mail verificado, domínio, autorização prévia e papel institucional. O Firestore é utilizado somente para `adminUsers` e `auditLogs`.

A persistência de ocorrências, protocolos, históricos, fotografias e configurações gerais permanece em memória, identificada como temporária. Cloud Storage permanece bloqueado por regras de negação integral. Não há envio real de e-mail.

## 4. Implementações principais

### Autenticação pública

- sessão anônima silenciosa;
- ID Token gerenciado pelo Firebase SDK;
- exigência de provedor anônimo nas APIs públicas;
- UID não exposto nas respostas;
- consulta por protocolo e chave independente do UID de criação.

### Autenticação e autorização administrativa

- Google Sign-In com popup e fallback por redirecionamento;
- sessão administrativa independente da sessão pública;
- verificação de ID Token com revogação;
- e-mail verificado e provedor `google.com` obrigatórios;
- domínio permitido e cadastro prévio no Firestore;
- hash SHA-256 do e-mail normalizado como ID do documento;
- vínculo transacional do UID no primeiro acesso;
- rejeição de UID divergente;
- papel proveniente exclusivamente do servidor.

### Papéis

- Administrador: operação integral, configurações, usuários e auditoria;
- Gestor: operação integral das ocorrências e atribuição, sem gestão de acesso;
- Atendente: somente ocorrências atribuídas e ações operacionais limitadas.

### Gestão de administradores

- listagem, criação e atualização por API protegida;
- edição de nome, departamento, papel e estado;
- proteção transacional do último Administrador ativo;
- auditoria dos eventos de acesso e gestão;
- script de bootstrap com dry-run, emulador e `--force` explícito.

### App Check e emuladores

- reCAPTCHA Enterprise preparado para produção;
- cabeçalho `X-Firebase-AppCheck`;
- enforcement obrigatório em produção;
- debug restrito ao desenvolvimento;
- Auth, Firestore e Storage Emulators e Emulator UI configurados;
- regras de Firestore e Storage com negação por padrão.

## 5. Modelos Firestore

### `adminUsers/{sha256(normalizedEmail)}`

Campos: `email`, `normalizedEmail`, `uid` opcional, `displayName`, `role`, `department` opcional, `active`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy` e `lastAuthorizedLoginAt` opcional.

### `auditLogs/{autoId}`

Campos: `eventType`, `actorUid`, `actorEmail`, `actorRole`, `targetType`, `targetId`, `timestamp`, `summary` e `requestCorrelationId`, todos limitados ao necessário.

## 6. Endpoints adicionados ou substituídos

- `GET /api/auth/admin-session`;
- `GET /api/admin/assignees`;
- `GET /api/admin/users`;
- `POST /api/admin/users`;
- `PATCH /api/admin/users/:id`;
- `GET /api/admin/audit-logs`.

As rotas administrativas de ocorrências e configurações foram mantidas e receberam proteção real. `GET /api/health` foi mantida e atualizada para 0.3.0.

## 7. Endpoints removidos

- `GET /api/auth/demo-users`;
- `POST /api/auth/login`.

## 8. Dependências adicionadas

- `firebase` 12.17.1;
- `firebase-admin` 14.2.0;
- `firebase-tools` 15.25.1;
- `@firebase/rules-unit-testing` 5.0.1.

Nenhuma dependência foi removida do `package.json`; `bun.lock` foi removido como artefato incompatível com npm.

## 9. Arquivos criados (52)

- `.firebaserc`
- `docs/APP_CHECK.md`
- `docs/ARQUIVOS_0.3.0.md`
- `docs/AUTENTICACAO_E_AUTORIZACAO.md`
- `docs/EMULADORES_FIREBASE.md`
- `docs/FIREBASE_CONFIGURACAO.md`
- `docs/INSPECAO_ZIP_FINAL_0.3.0.md`
- `docs/MATRIZ_DE_PERMISSOES.md`
- `docs/PRIMEIRO_ADMINISTRADOR.md`
- `docs/REGRAS_DE_SEGURANCA_0.3.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.3.0.md`
- `docs/TESTES_0.3.0.md`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `scripts/bootstrapAdmin.ts`
- `server/config/firebaseAdmin.ts`
- `server/controllers/adminUserController.ts`
- `server/middleware/asyncHandler.ts`
- `server/middleware/correlationId.ts`
- `server/middleware/requireAnonymousUser.ts`
- `server/middleware/requireAppCheck.ts`
- `server/middleware/requireAuthorizedAdmin.ts`
- `server/middleware/requireFirebaseUser.ts`
- `server/middleware/requireRole.ts`
- `server/repositories/adminUserRepository.ts`
- `server/repositories/auditLogRepository.ts`
- `server/services/adminAuthorizationService.ts`
- `server/services/adminUserService.ts`
- `server/services/appCheckTokenService.ts`
- `server/services/firebaseTokenService.ts`
- `server/types/firebase.ts`
- `server/utils/email.ts`
- `src/auth/adminAuth.ts`
- `src/auth/publicAuth.ts`
- `src/components/admin/AdminUserManagement.tsx`
- `src/components/admin/AuditLogPanel.tsx`
- `src/config/firebase.ts`
- `src/config/firebaseEnvironment.ts`
- `src/config/version.ts`
- `src/context/PublicAuthContext.tsx`
- `src/routes/AuthorizedAdminRoute.tsx`
- `src/services/firebase/appCheckTokenService.ts`
- `storage.rules`
- `tests/adminAuthorization.test.ts`
- `tests/adminUserRepository.test.ts`
- `tests/authenticationAuthorizationApi.test.ts`
- `tests/firebaseInstances.test.ts`
- `tests/firebaseIntegration.test.ts`
- `tests/firebaseRules.test.ts`
- `tests/helpers/serverTestHarness.ts`
- `tests/occurrencePermissions.test.ts`

## 10. Arquivos modificados (54)

- `.env.example`
- `.gitignore`
- `CHANGELOG.md`
- `README.md`
- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/ATIVOS_INSTITUCIONAIS.md`
- `docs/IDENTIDADE_INSTITUCIONAL.md`
- `docs/MODO_DEMONSTRATIVO.md`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `server/app.ts`
- `server/config/env.ts`
- `server/controllers/authController.ts`
- `server/controllers/configController.ts`
- `server/controllers/occurrenceController.ts`
- `server/index.ts`
- `server/middleware/errorHandler.ts`
- `server/repositories/inMemoryDatabase.ts`
- `server/repositories/initialData.ts`
- `server/routes/apiRoutes.ts`
- `server/services/configService.ts`
- `server/services/occurrenceService.ts`
- `server/types/express.d.ts`
- `server/validators/schemas.ts`
- `src/App.tsx`
- `src/components/common/DemoModeBanner.tsx`
- `src/components/common/Footer.tsx`
- `src/components/common/Header.tsx`
- `src/config/env.ts`
- `src/context/AdminAuthContext.tsx`
- `src/layouts/AdminLayout.tsx`
- `src/models/admin.ts`
- `src/models/config.ts`
- `src/models/http.ts`
- `src/models/occurrence.ts`
- `src/pages/HomePage.tsx`
- `src/pages/admin/AdminDashboardPage.tsx`
- `src/pages/admin/AdminLoginPage.tsx`
- `src/pages/admin/AdminOccurrenceDetailPage.tsx`
- `src/pages/admin/AdminOccurrencesPage.tsx`
- `src/pages/admin/AdminSettingsPage.tsx`
- `src/routes/AppRouter.tsx`
- `src/services/adminService.ts`
- `src/services/apiClient.ts`
- `src/services/configService.ts`
- `src/services/occurrenceService.ts`
- `src/validators/responses.ts`
- `src/vite-env.d.ts`
- `tests/apiClient.test.ts`
- `tests/routingAndBranding.test.tsx`
- `tests/staticPolicy.test.ts`
- `tsconfig.json`

## 11. Arquivos removidos (4)

- `bun.lock`
- `server/middleware/auth.ts`
- `server/services/authService.ts`
- `src/routes/DemoAdminRoute.tsx`

## 12. Integridade dos ativos

- horizontal antes/depois: `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731`;
- vertical antes/depois: `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427`.

Os ativos permaneceram inalterados.

## 13. Divergências e limitações

O registro npm disponível neste ambiente não contém os pacotes Firebase declarados. `npm ci` falhou com `E404` para `@firebase/rules-unit-testing`. Em razão disso, o grafo completo do `package-lock.json` não pôde ser regenerado e as dependências não foram instaladas. O arquivo foi atualizado para versão 0.3.0 e declara as dependências na raiz, mas deve ser regenerado por `npm install --package-lock-only` em ambiente com acesso ao registro npm oficial antes do uso de `npm ci`.

Como consequência, typecheck completo, ESLint, Vitest, build e Firebase Emulator Suite não puderam ser executados. Não se afirma validação em nuvem ou por emuladores. Foram concluídas análise sintática e auditoria estática complementar, sem erros.

## 14. Pendências para ativação em nuvem

- project ID e configuração pública do Web App;
- domínios administrativos permitidos;
- e-mail do primeiro Administrador;
- chave pública reCAPTCHA Enterprise;
- URLs e domínios autorizados;
- IAM da identidade de execução;
- validação real do Google Sign-In, App Check e Firestore.

## 15. Pendências propostas para 0.4.0

- Firestore para ocorrências, protocolos e históricos;
- contador transacional de protocolos;
- hash persistente da chave de acompanhamento;
- Cloud Storage com remoção de EXIF e regras específicas;
- notificações idempotentes por função de servidor;
- dados institucionais definitivos de locais;
- rate limiting definitivo;
- revisão WCAG 2.2 AA e implantação.
