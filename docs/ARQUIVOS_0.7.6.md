# Mapeamento e Catálogo de Arquivos — Versão 0.7.6

Este documento cataloga todos os arquivos criados, modificados e seus respectivos papéis arquiteturais na versão **0.7.6** do **Sistema Institucional de Manutenção da Infraestrutura Física**.

---

## 1. Arquivos Criados

| Caminho do Arquivo | Papel e Responsabilidade Arquitetural |
| :--- | :--- |
| `server/providers/ews/ntlmClient.ts` | Cliente NTLM/NTLMv2 nativo com geração de Type 1 / Type 3, decodificação de Type 2 Challenge, e transporte HTTPS com socket persistente keep-alive e validação TLS estrita. |
| `server/providers/ews/ntlmCrypto.ts` | Módulo dedicado e isolado de primitivas criptográficas NTLM: MD4 puro (RFC 1320), HMAC-MD5, NT-Hash, NTLMv2-Hash, LMv2 Response e NTLMv2 Blob (MS-NLMP §4.2.2.2.1). |
| `server/providers/ews/ewsSoap.ts` | Geração do envelope SOAP 1.1 `CreateItem` com `SendAndSaveCopy` e `DistinguishedFolderId Id="sentitems"`, sanitização estrita de XML (`escapeXml`) e parser defensivo com proteção contra injeção XXE. |
| `server/providers/ewsEmailProvider.ts` | Implementação de `EmailProvider` para o Exchange Web Services (EWS) com matriz conservadora de erros (mapeamento de `NoError`, 401 definitivo, erros de transporte ambíguos para `UNCERTAIN`, `ErrorInvalidRecipients`, `ErrorServerBusy`, `ErrorQuotaExceeded`). |
| `server/utils/artifactRegistryParser.ts` | Parser defensivo de métricas de imagens do Artifact Registry, com validação de tamanho de bytes e suporte ao campo `metadata.imageSizeBytes` do `gcloud`. |
| `scripts/preMigrationResendCheck.ts` | Script somente leitura de diagnóstico e pré-check para transição operacional segura Resend -> EWS. |
| `tests/cryptoNtlmReference076.test.ts` | Testes unitários com vetores de teste oficiais RFC 1320 (MD4) e MS-NLMP §4.2.4 (NTLMv2), geração Type 1/Type 3, parsing Type 2 e validação de não-vazamento de credenciais NTLM sem circularidade. |
| `tests/preMigrationResendCheck.test.ts` | Testes unitários puros da lógica de avaliação do script de transição Resend -> EWS, cobrindo Casos A a F (notificações ativas, tentativas com provedor pai, webhooks UNMATCHED_PENDING). |
| `tests/ewsSoap.test.ts` | Testes unitários para escaping XML, geração de envelopes SOAP e parsing de respostas de sucesso, falhas SOAP Fault e erros do Exchange. |
| `tests/ewsEmailProvider.test.ts` | Testes unitários de `EwsEmailProvider` cobrindo validação estrita de HTTPS, matriz completa de respostas HTTP, códigos EWS e cenários de transporte com mocks NTLM. |
| `tests/notificationProviderBinding076.test.ts` | Testes de integração do binding determinístico de provedor por notificação (`ews` vs `resend`), ausência de fallback automático silencioso, isolamento de webhooks e transição de `markSent` sem `providerMessageId`. |
| `tests/artifactRegistrySnapshot076.test.ts` | Testes unitários e estáticos do parser do Artifact Registry e verificação do desacoplamento de `SERVER_ENV`. |
| `tests/ewsIntegration.optIn.test.ts` | Teste opt-in de integração real com o servidor Exchange (`RUN_EWS_INTEGRATION=true`). |
| `docs/ARQUIVOS_0.7.6.md` | Catálogo de arquivos e histórico de alterações da versão 0.7.6. |
| `docs/HOMOLOGACAO_MANUAL_0.7.6.md` | Roteiro de testes manuais e critérios de aceitação para homologação da versão 0.7.6. |
| `docs/IMPLANTACAO_0.7.6.md` | Guia de implantação no Cloud Run e Cloudflare Pages com dados reais de projeto GCP, região us-west1 e secrets. |
| `docs/EWS_CONFIGURACAO_0.7.6.md` | Guia técnico de configuração, credenciais de serviço e resolução de problemas do EWS/Exchange com placeholders institucionais. |

---

## 2. Arquivos Modificados

| Caminho do Arquivo | Modificações Realizadas |
| :--- | :--- |
| `server/providers/emailProvider.ts` | Generalização da interface `EmailProvider` para aceitar `name: 'resend' \| 'ews'` e definição de `providerMessageId?: string` opcional em `EmailSendResult`. |
| `server/providers/ews/ntlmClient.ts` | Exigência estrita de protocolo HTTPS, flags unsigned 32-bit e implementação pura de MD4 (RFC 1320). |
| `server/providers/ewsEmailProvider.ts` | Validação estrita de URL via `new URL()` exigindo protocolo HTTPS e hostname válido. |
| `server/models/notificationDomain.ts` | Atualização do tipo `provider` em `NotificationOutboxItem` para `'resend' \| 'ews'`. |
| `server/domain/notificationOutbox.ts` | Adição do parâmetro `provider` em `createOccurrenceNotificationItems` e `createTestNotificationItem` para vinculação determinística no enfileiramento. |
| `server/repositories/occurrenceRepository.ts` | Suporte a `notificationProvider?: 'resend' \| 'ews'` em `OccurrenceCreationPersistenceOptions` e repasse na transação de criação. |
| `server/services/occurrenceService.ts` | Injeção de `defaultEmailProvider` no construtor e binding explícito do provedor ativo ao criar ocorrências. |
| `server/repositories/notificationOutboxRepository.ts` | Desserialização do campo `provider` em `fromSnapshot`, suporte a `providerMessageId` opcional em `markSent`, isolamento estrito de webhooks Resend rejeitando eventos em itens EWS com `inconsistent` e preservação das invariantes de entrega. |
| `server/services/notificationService.ts` | Suporte multi-provedor com disponibilidade provider-aware (`ewsEnabled` vs `resendEnabled`), roteamento estrito por item (`item.provider`), dinamicidade de `activeProvider` em `runtimeStatus` e preservação dos webhooks Resend. |
| `server/config/env.ts` | Inclusão e validação estrita de `EMAIL_PROVIDER` (`'ews'` ou `'resend'`), validação HTTPS de `EWS_URL`, configuração desacoplada de `EWS_*` e defaults seguros para desenvolvimento. |
| `server/config/firebaseAdmin.ts` | Desacoplamento da interface `FirebaseAdminConfig` de `ServerEnvironment`, permitindo inicialização limpa em scripts e testes. |
| `server/app.ts` | Instanciação e injeção do `EwsEmailProvider` e do provedor ativo em `OccurrenceService`, `NotificationService` e `ConfigService`. |
| `scripts/artifactRegistrySnapshot.ts` | Eliminação de referências a `SERVER_ENV`, resolução desacoplada de runtime Firebase e integração com `parseArtifactRegistryRecords`. |
| `infra/cloudflare/maintenance-worker/src/index.ts` | Endpoint de verificação e resposta JSON atualizados para versão `'0.7.6'`. |
| `infra/cloudflare/maintenance-worker/package.json` | Versionamento para `0.7.6`. |
| `infra/cloudflare/maintenance-worker/package-lock.json` | Versionamento para `0.7.6`. |
| `tests/preDeployment071.test.ts` | Atualização das asserções de pre-deployment para versão `'0.7.6'`. |
| `.env.example` | Documentação das variáveis de configuração do EWS e do seletor `EMAIL_PROVIDER`. |
| `src/models/infrastructure.ts` | Tipagem de `provider: 'Resend' \| 'EWS'` em `InfrastructureOverview` e `NotificationStatus`. |
| `src/validators/responses.ts` | Schemas Zod atualizados para aceitar `z.enum(['Resend', 'EWS'])`. |
| `src/components/admin/NotificationSettingsPanel.tsx` | Exibição dinâmica do provedor ativo e ajuste de textos explicativos. |
| `src/pages/admin/AdminInfrastructurePage.tsx` | Exibição dinâmica do provedor ativo no painel de infraestrutura e capacidade. |
| `package.json` | Versionamento para `0.7.6` e adição do script `"test:ews"`. |
| `package-lock.json` | Versionamento para `0.7.6`. |
| `src/config/version.ts` | Constante `APP_VERSION` atualizada para `'0.7.6'`. |
| `metadata.json` | Versão `0.7.6` e inclusão de `EWS_TRANSACTIONAL_EMAIL` nas capacidades. |
| `firebase-blueprint.json` | Atualização de arquitetura e notas de versão para `0.7.6`. |
| `CHANGELOG.md` | Notas de release detalhadas da versão 0.7.6. |
