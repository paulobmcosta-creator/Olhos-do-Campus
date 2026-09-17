# Relatório e Evidências de Testes — Versão 0.7.6

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Data da Homologação Final:** 2026-08-24  
**Runtime de Execução:** Node.js v22.22.2 LTS / npm 10.9.7 / OpenJDK 21.0.12.1 LTS  
**Conformidade de Engine:** `node -v` = `v22.22.2`, `engines.node` = `>=22.22.2 <23` (**COMPATÍVEL: SIM**)

---

## 1. Resumo Geral de Execução dos Gates

| Gate / Comando | Descrição | Status | Evidência / Métrica |
| :--- | :--- | :---: | :--- |
| `npm ci` | Instalação limpa de dependências | **PASS** | 1198 pacotes instalados, 0 vulnerabilidades (Exit code 0) |
| `npm run typecheck` | Checagem estática de tipos TypeScript | **PASS** | `tsc --noEmit` executado com 0 erros (Exit code 0) |
| `npm run lint` | Linter estático com zero warnings | **PASS** | `eslint . --max-warnings=0` (0 erros, 0 avisos, Exit code 0) |
| `npm test` | Suíte regular de testes unitários e de integração Vitest | **PASS** | 55 arquivos passados, 2 skipped opt-in (386 testes aprovados, 3 skipped opt-in, 0 falhos, Exit code 0) |
| `npm run test:ews` | Teste de integração EWS (sem opt-in flag) | **PASS** | 1 teste de validação de configuração aprovado, 1 teste real skipped (0 conexões, Exit code 0) |
| `npm run test:rules` | Testes de segurança Firestore/Storage rules (Emulator) | **PASS** | 2 testes aprovados no Emulator Suite (Exit code 0) |
| `npm run test:firebase` | Testes de integração Firebase (Auth/Firestore/Storage) | **PASS** | 19 testes aprovados no Emulator Suite (Exit code 0) |
| `npm run test:storage` | Testes de abstração e cleanup de Storage | **PASS** | 6 testes aprovados no Emulator Suite (Exit code 0) |
| `npm run worker:typecheck` | Checagem de tipos do Cloudflare Maintenance Worker | **PASS** | `tsc --noEmit` no worker (0 erros, Exit code 0) |
| `npm run worker:test` | Testes unitários do Cloudflare Maintenance Worker | **PASS** | 4 testes aprovados (Exit code 0) |
| `npm run build` | Compilação de produção (Client Vite + Server esbuild) | **PASS** | Client (687.95 kB JS, 25.32 kB CSS) + Server (427.9 kB JS) (Exit code 0) |
| `npm audit --omit=dev` | Auditoria de dependências de produção | **PASS** | `found 0 vulnerabilities` (Exit code 0) |

---

## 2. Transcrição Literal da Saída do Vitest (`npm test`)

```text
 RUN  v4.1.10 C:/Projetos/Sistema de Infraestrutura/olhos-do-campus-0.7.6

 ✓ tests/productionPackaging061.test.ts (2 tests) 4431ms
     ✓ removes dev-only modules and Bun lockfiles while preserving production modules  4143ms
 ✓ tests/staticPolicy.test.ts (14 tests) 2722ms
     ✓ não contém a marca anterior nem promessa indevida de anonimato  2406ms
 ✓ tests/occurrenceService.test.ts (6 tests) 2446ms
     ✓ gera protocolo anual, preserva valores reportados e retorna a chave somente na criação  405ms
     ✓ consulta com chave correta e usa resposta genérica para combinação inválida  909ms
     ✓ corrige categoria e local preservando origem, justificativa, SLA, histórico e auditoria  370ms
     ✓ persiste mensagem pública e observação interna como eventos separados  386ms
stderr | tests/authenticationAuthorizationApi.test.ts > API pública e segurança > exige App Check e autenticação anônima para criar
App Check rejeitado [98f5d20d-56d4-4a57-a0a3-e9a9e015028d]: invalid app check

stderr | tests/authenticationAuthorizationApi.test.ts > API pública e segurança > exige App Check e autenticação anônima para criar
ID Token rejeitado [fdf2b85d-00cb-447a-bf1d-3aa85e84f0a3]: invalid token

 ✓ tests/photoApi.test.ts (9 tests) 5110ms
     ✓ aceita 0, 1 e 3 fotografias e rejeita a quarta  1065ms
     ✓ rejeita MIME divergente, conteúdo corrompido e arquivo acima de 8 MB  814ms
     ✓ mantém fotografia inicial interna e não a serve pelo acompanhamento público  604ms
     ✓ publica conscientemente fotografia de solução e a serve sem chave na URL  764ms
     ✓ protege o download público por App Check, autenticação anônima e protocolo/chave  609ms
     ✓ permite a Administrador e Gestor adicionar, publicar e excluir fotografia de solução  731ms
 ✓ tests/authenticationAuthorizationApi.test.ts (6 tests) 1746ms
     ✓ cria e acompanha sem expor segredos ou dados administrativos  606ms
     ✓ exige expectedVersion, rejeita conflito e deriva autoria do token  622ms
 ✓ tests/imageProcessingService.test.ts (12 tests) 2506ms
     ✓ aceita JPEG válido e produz WebP principal + miniatura  368ms
     ✓ aceita PNG válido e produz WebP principal + miniatura  351ms
     ✓ aceita WEBP válido e produz WebP principal + miniatura  359ms
     ✓ rejeita imagem acima do limite de pixels decodificados  1009ms
     ✓ redimensiona preservando proporção e não amplia imagens pequenas  349ms
 ✓ tests/occurrenceDomainRules.test.ts (6 tests) 4950ms
     ✓ permite encaminhar apenas à equipe e rejeita responsável fora da equipe selecionada  319ms
     ✓ rejeita A→A e A→inexistente  468ms
     ✓ aceita A→B e A→B→C, mas rejeita A→B→A  3382ms
 ✓ tests/routingAndBranding.test.tsx (4 tests) 5312ms
     ✓ renderiza nome fantasia, nome oficial e marca com texto alternativo adequado  1574ms
     ✓ navega para a rota real de acompanhamento  3075ms
     ✓ exibe login Google e não apresenta seleção de perfil demonstrativo  344ms
     ✓ renderiza página não encontrada em URL inexistente  305ms
 ✓ tests/trackingKey.test.ts (5 tests) 3173ms
     ✓ scrypt com salt valida a chave correta e rejeita a incorreta  1565ms
     ✓ normaliza caixa da chave deliberadamente  901ms
     ✓ salt diferente produz derivação diferente e formato inválido é rejeitado  657ms
 ✓ tests/sla060.test.ts (14 tests) 772ms
 ✓ tests/photoGallery.test.tsx (3 tests) 1240ms
     ✓ separa fotografias do registro e da solução, carrega miniaturas protegidas e permite ampliar  946ms
 ✓ tests/notificationProviderBinding076.test.ts (9 tests) 3342ms
     ✓ marca tentativa como DELIVERY_UNCERTAIN se a persistência local falhar após o envio confirmado pelo provedor  536ms
     ✓ fluxo real: OccurrenceService.create propaga deterministicamente defaultEmailProvider para o repositório e outbox  2584ms
 ✓ tests/reportExport060.test.ts (3 tests) 1630ms
     ✓ gera CSV UTF-8 com campos operacionais e sem dados de segurança  1095ms
     ✓ gera XLSX como contêiner ZIP e PDF com assinatura válida  527ms
 ✓ tests/internalNoteAudience060.test.ts (7 tests) 785ms
     ✓ Gestor membro registra RESPONSIBLE_TEAM com snapshot da equipe  338ms
 ✓ tests/occurrencePermissions.test.ts (2 tests) 463ms
 ✓ tests/apiClient.test.ts (7 tests) 64ms
 ✓ tests/imageClient.test.ts (4 tests) 93ms
 ✓ tests/pagesCors070.test.ts (5 tests) 228ms
 ✓ tests/analytics060.test.ts (1 test) 317ms
     ✓ calcula contagens, médias, medianas, percentuais e distribuições sem confundir abertura com encerramento  313ms
 ✓ tests/operationalAdministration060.test.ts (4 tests) 115ms
 ✓ tests/brandImage.test.tsx (1 test) 76ms
 ✓ tests/maintenanceSignatureApi070.test.ts (2 tests) 151ms
 ✓ tests/photoService.test.ts (5 tests) 127ms
 ✓ tests/infrastructure070.test.ts (12 tests) 88ms
 ✓ tests/notificationOutbox070.test.ts (18 tests) 99ms
 ✓ tests/r2Storage070.test.ts (5 tests) 44ms
 ✓ tests/notificationCorrelation072.test.ts (22 tests) 104ms
 ✓ tests/preDeployment071.test.ts (9 tests) 46ms
 ✓ tests/adminRoles060.test.ts (3 tests) 50ms
 ✓ tests/cryptoNtlmReference076.test.ts (17 tests) 29ms
 ✓ tests/notificationAttempts073.test.ts (12 tests) 389ms
 ✓ tests/notificationTechnicalRetry074.test.ts (8 tests) 87ms
 ✓ tests/adminUserRepository.test.ts (5 tests) 32ms
 ✓ tests/firebaseRuntime.test.ts (10 tests) 25ms
 ✓ tests/preMigrationResendCheck.test.ts (23 tests) 23ms
 ✓ tests/pagination060.test.ts (3 tests) 28ms
 ✓ tests/maintenanceWorker070.test.ts (4 tests) 57ms
 ✓ tests/artifactRegistrySnapshot076.test.ts (6 tests) 13ms
 ✓ tests/occurrenceStateMachine.test.ts (5 tests) 71ms
 ✓ tests/serverEnvironment.test.ts (10 tests) 82ms
 ✓ tests/notificationDelivery071.test.ts (22 tests) 52ms
 ✓ tests/ewsEmailProvider.test.ts (14 tests) 65ms
 ✓ tests/bootstrapContractVersion062.test.ts (2 tests) 14ms
 ✓ tests/firestoreEnterprise075.test.ts (2 tests) 15ms
 ✓ tests/referenceData.test.ts (6 tests) 204ms
 ✓ tests/validation.test.ts (4 tests) 27ms
 ✓ tests/adminAuthorization.test.ts (4 tests) 21ms
 ✓ tests/fallbackDeletion071.test.ts (8 tests) 22ms
 ✓ tests/ewsSoap.test.ts (9 tests) 67ms
 ✓ tests/polling060.test.ts (3 tests) 20ms
 ✓ tests/publicOccurrence.test.ts (2 tests) 10ms
 ✓ tests/ewsIntegration.optIn.test.ts (2 tests | 1 skipped) 7ms
 ✓ tests/firestoreSerialization.test.ts (1 test) 9ms
 ↓ tests/r2Integration.optIn.test.ts (1 test | 1 skipped)
 ↓ tests/resendIntegration.optIn.test.ts (1 test | 1 skipped)
 ✓ tests/firebaseInstances.test.ts (2 tests) 8ms
 ✓ tests/protocol.test.ts (3 tests) 16ms

 Test Files  55 passed | 2 skipped (57)
      Tests  386 passed | 3 skipped (389)
   Start at  23:07:53
   Duration  145.45s (transform 13.06s, setup 60.08s, import 88.07s, tests 43.62s, environment 202.34s)
```

---

## 3. Discriminação dos Testes Excluídos da Suíte Regular e Testes Opt-In

O projeto possui **60 arquivos de teste no total**, distribuídos em:
- **3 arquivos executados exclusivamente via Firebase Emulator Suite** (`tests/firebaseRules.test.ts`, `tests/firebaseIntegration.test.ts`, `tests/storageIntegration.test.ts`);
- **57 arquivos pertencentes à suíte regular do Vitest** (55 arquivos aprovados e 2 arquivos de integração real com skips intencionais opt-in).

### 3.1. Testes Excluídos da Suíte Regular (Executados via Firebase Emulator Suite)
- **`tests/firebaseRules.test.ts`:** 2 testes aprovados via `npm run test:rules` com emuladores Firestore e Storage (Exit code 0).
- **`tests/firebaseIntegration.test.ts`:** 19 testes aprovados via `npm run test:firebase` com emuladores Auth, Firestore e Storage (Exit code 0).
- **`tests/storageIntegration.test.ts`:** 6 testes aprovados via `npm run test:storage` com emuladores Firestore e Storage (Exit code 0).

### 3.2. Testes de Integração Externa (Opt-In / Skips Intencionais)
- **EWS Real Integration (`tests/ewsIntegration.optIn.test.ts`):** 1 teste local de validação de configuração aprovado (exigência fail-fast de `EWS_TEST_RECIPIENT` sem conexões de rede) e 1 teste de envio SOAP real opt-in `SKIPPED_OPT_IN` (quando `RUN_EWS_INTEGRATION !== 'true'`).
- **Resend Real Integration (`tests/resendIntegration.optIn.test.ts`):** `SKIPPED_OPT_IN` (Exige chave de API real do Resend).
- **Cloudflare R2 Real Integration (`tests/r2Integration.optIn.test.ts`):** `SKIPPED_OPT_IN` (Exige credenciais reais de bucket R2).

---

## 3.3. Testes do Diagnóstico Pré-Check Resend (`tests/preMigrationResendCheck.test.ts`)

A suíte cobre **23 cenários de teste** determinísticos estritamente **fail-closed** e compatíveis com a semântica legada do runtime:
1. **Caso 1:** Tudo zero e sem pendências Resend $\rightarrow$ `READY_TO_DISABLE_RESEND: true`.
2. **Caso 2:** `PENDING > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
3. **Caso 3:** `PROCESSING > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
4. **Caso 4:** `DEFERRED > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
5. **Caso 5:** `RETRY_PENDING > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
6. **Caso 6:** `SENT > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
7. **Caso 7:** `DELIVERY_UNCERTAIN > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
8. **Caso 8:** `FAILED_CONFIGURATION > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
9. **Caso 9:** Status desconhecido / `OTHER > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false`.
10. **Caso 10:** `FAILED > 0` $\rightarrow$ `READY_TO_DISABLE_RESEND: false` (notificações com falha podem ser reprocessadas pelo worker).
11. **Caso 11:** DeliveryAttempt EWS `ACCEPTED` sem `deliveredAt` $\rightarrow$ não contabilizada como Resend.
12. **Caso 12:** DeliveryAttempt Resend `ACCEPTED` sem `deliveredAt` $\rightarrow$ bloqueia (`false`).
13. **Caso 13:** Tentativa órfã (notificação pai inexistente) $\rightarrow$ `orphanAttemptsCount > 0`, bloqueia (`false`).
14. **Caso 14:** Falha ao ler pai (`readErrorsCount > 0`) $\rightarrow$ bloqueia (`false`).
15. **Caso 15:** Webhook Resend `UNMATCHED_PENDING` $\rightarrow$ bloqueia (`false`).
16. **Caso 16:** Webhook finalizado (`PROCESSED`, `UNMATCHED_EXPIRED`, `INCONSISTENT`) $\rightarrow$ não bloqueia.
17. **Caso 17:** Falha ao consultar `notificationWebhookEvents` (`readErrorsCount > 0`) $\rightarrow$ bloqueia (`false`).
18. **Caso Legado A:** Notificação sem campo `provider` (ausente/undefined) com `status: 'PENDING'` $\rightarrow$ interpretada como Resend e bloqueia.
19. **Caso Legado B:** Notificação sem campo `provider` com `status: 'DELIVERED'` $\rightarrow$ interpretada como Resend terminal e não bloqueia.
20. **Caso Legado C:** Notificação com `provider` desconhecido e `status: 'PENDING'` $\rightarrow$ conservadoramente interpretada como Resend e bloqueia.
21. **Caso Legado D:** Notificação com `provider: 'ews'` e `status: 'PENDING'` $\rightarrow$ não é contada nas notificações Resend.
22. **normalizeNotificationProvider:** Mapeia exatamente `ews` $\rightarrow$ `ews`, e `resend`/`undefined`/`null`/`''`/desconhecido $\rightarrow$ `resend`.
23. **diagnoseResendMigrationFromFirestore (Fake/Mock Firestore):** Comprova que a leitura completa da outbox sem filtro rígido normaliza corretamente documentos legados sem `provider`.

---

## 4. Comprovação Real do Artifact Registry

- **Status:** `REAL OUTPUT VERIFIED`
- **Comando Executado (Somente Leitura):**
  ```bash
  gcloud artifacts docker images list us-west1-docker.pkg.dev/gen-lang-client-0120954905/cloud-run-source-deploy --include-tags --format=json --project=gen-lang-client-0120954905
  ```
- **Propriedades Observadas no Retorno Real do GCP:**
  - `createTime`: string ISO-8601
  - `updateTime`: string ISO-8601
  - `package`: string
  - `tags`: string[]
  - `version`: string (digest sha256)
  - `metadata`: object contendo:
    - `buildTime`: string
    - `mediaType`: string (`application/vnd.docker.distribution.manifest.v2+json`)
    - `imageSizeBytes`: string numérica representando o tamanho exato em bytes (ex: `"149512299"`)
- **Adequação do Parser:** `server/utils/artifactRegistryParser.ts` atualizado para extrair nativamente `metadata.imageSizeBytes` e rejeitar registros sem tamanho válido (fail-fast).

---

## 5. Cobertura dos 22 Cenários Críticos Obrigatórios

| # | Cenário Crítico Obrigatório | Arquivo de Teste de Cobertura | Status |
| :---: | :--- | :--- | :---: |
| 1 | Ocorrência real vinculada a EWS no enfileiramento | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 2 | Ocorrência real vinculada a Resend no enfileiramento | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 3 | Provedor histórico preservado após mudança de configuração ativa | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 4 | Availability provider-aware (`ewsEnabled` vs `resendEnabled`) | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 5 | Ausência de fallback automático silencioso entre provedores | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 6 | `EMAIL_PROVIDER` inválido/vazio rejeitado no startup com erro claro | `tests/serverEnvironment.test.ts` | **PASS** |
| 7 | HTTP EWS rejeitado estritamente em todas as camadas | `tests/ewsEmailProvider.test.ts` / `tests/serverEnvironment.test.ts` | **PASS** |
| 8 | HTTPS EWS aceito com validação de hostname e sem credenciais na URL | `tests/ewsEmailProvider.test.ts` / `tests/serverEnvironment.test.ts` | **PASS** |
| 9 | Timeout de conexão/socket classificado conservadoramente como `UNCERTAIN` | `tests/ewsEmailProvider.test.ts` | **PASS** |
| 10 | Conexão encerrada/resetada após envio provável $\rightarrow$ `UNCERTAIN` | `tests/ewsEmailProvider.test.ts` | **PASS** |
| 11 | `NoError` sem `providerMessageId` tratado como sucesso sem ID fabricado | `tests/ewsEmailProvider.test.ts` / `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 12 | Falha de persistência local pós-aceite do provedor $\rightarrow$ `markDeliveryUncertain` | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 13 | Webhook Resend recebido para notificação EWS $\rightarrow$ rejeição com `inconsistent` | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 14 | Webhook Resend para mensagem histórica reconciliável mesmo com EWS ativo | `tests/notificationProviderBinding076.test.ts` | **PASS** |
| 15 | Retry técnico em `SAME_ATTEMPT` para erros transitórios pré-transporte | `tests/ewsEmailProvider.test.ts` / `tests/notificationDelivery071.test.ts` | **PASS** |
| 16 | Nova tentativa em `NEW_ATTEMPT` para falhas com nova chave/tentativa | `tests/notificationDelivery071.test.ts` | **PASS** |
| 17 | Consumo da outbox sem duplicação e com lease atômico | `tests/notificationDelivery071.test.ts` | **PASS** |
| 18 | Script Artifact Registry snapshot desacoplado de segredos Cloudflare R2 | `tests/artifactRegistrySnapshot076.test.ts` | **PASS** |
| 19 | Artifact Registry parser: campo ausente $\ne$ zero (fail-fast preventivo) | `tests/artifactRegistrySnapshot076.test.ts` | **PASS** |
| 20 | Versionamento `0.7.6` consistente em todos os manifestos e arquivos | `tests/preDeployment071.test.ts` | **PASS** |
| 21 | Cloudflare Maintenance Worker reportando versão `0.7.6` no health check | `tests/maintenanceWorker070.test.ts` | **PASS** |
| 22 | Teste de pre-deployment atualizado e em conformidade para `0.7.6` | `tests/preDeployment071.test.ts` | **PASS** |

