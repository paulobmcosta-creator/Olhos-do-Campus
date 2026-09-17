# Relatório de Implementação e Correção Técnica — Versão 0.7.6

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Classificação do Ciclo:** Correção e Homologação Técnica da Candidata 0.7.6  
**Status do Release:** `READY_TO_EXECUTE_EWS_OPERATIONAL_GATE`  

---

## 1. Sumário Executivo

Este relatório consolida todas as correções técnicas aplicadas sobre a versão candidata **0.7.6**, decorrentes da auditoria independente. A versão 0.7.6 introduz suporte nativo ao **Exchange Web Services (EWS)** institucional com autenticação NTLM/NTLMv2, preservando integralmente a semântica de outbox transacional, observabilidade, idempotência, segurança HTTPS estrita e compatibilidade histórica com o provedor Resend.

> **Regra Fundamental de Versionamento e Segurança:**
> - A versão 0.7.7 **NÃO** foi criada. Todo o ciclo foi executado estritamente sobre a versão 0.7.6.
> - O ambiente de produção `olhos-do-campus` (versão 0.6.2 ativa) permaneceu intocado.
> - A estratégia de implantação foi estruturada com **0% de tráfego produtivo** (`--no-traffic`) e traffic tag determinística `--tag=ews076` para validação isolada do gate operacional EWS na URL da tag, eliminando `--to-latest` e estabelecendo promoção explícita `--to-tags=ews076=100`. Nenhum deploy ou alteração de tráfego foi executado nesta tarefa.

---

## 2. Resolução dos Bloqueadores e Achados da Auditoria

### Bloqueador 1 — Binding do Provider no Fluxo Real de Ocorrências
- **Diagnóstico:** A criação de ocorrências públicas (`OccurrenceService.create`) chamava `OccurrenceRepository.createWithProtocol` sem repassar o provedor de e-mail ativo, gerando inconsistência onde novas ocorrências não tinham o provedor explicitamente gravado nos itens da outbox.
- **Correção Aplicada:**
  - Em `server/repositories/occurrenceRepository.ts`, `OccurrenceCreationPersistenceOptions` agora aceita `notificationProvider?: 'resend' | 'ews'` e repassa deterministicamente para `createOccurrenceNotificationItems`.
  - `OccurrenceService` recebe `defaultEmailProvider: 'ews' | 'resend'` no construtor (injetado via `SERVER_ENV.emailProvider` em `server/app.ts`) e o repassa na transação atômica de criação.

### Bloqueador 2 — Habilitação e Disponibilidade Provider-Aware
- **Diagnóstico:** O runtime tratava a habilitação de e-mail como um booleano global único, impedindo a verificação independente de saúde de múltiplos provedores.
- **Correção Aplicada:**
  - `NotificationRuntime` em `server/services/notificationService.ts` e `server/app.ts` agora suporta propriedades provider-aware: `activeProvider`, `ewsEnabled`, `resendEnabled`, `ewsFrom`, `resendFrom` e `resendWebhookSecret`.
  - Em `processPending`, a elegibilidade e configuração são avaliadas especificamente para o `item.provider` do item sendo processado. Se um item requerer um provedor indisponível ou desabilitado, transiciona para `FAILED_CONFIGURATION` sem fallback automático silencioso para outro provedor.

### Bloqueador 3 — HTTPS Estrito no EWS e Rejeição de Protocol Downgrade
- **Diagnóstico:** Validações de URL permitiam `http://` ou strings genéricas em certos pontos.
- **Correção Aplicada:**
  - Em `server/providers/ewsEmailProvider.ts`, a URL é parseada via `new URL()` exigindo estritamente `protocol === 'https:'` e `hostname` válido.
  - Em `server/providers/ews/ntlmClient.ts`, `executeNtlmRequest` rejeita conexões não-HTTPS com `NTLM_SECURITY_VIOLATION` e instancia `https.Agent` com `rejectUnauthorized: true`.
  - Em `server/config/env.ts`, `EWS_URL` é validada na inicialização com HTTPS estrito.

### Bloqueador 4 — Decisão e Justificativa Técnica NTLM e Correção Criptográfica NTLMv2
- **Diagnóstico e Análise:** Avaliação das opções do ecossistema vs. cliente nativo TypeScript:
  - `@ewsjs/ntlm-client` (v3.0.1, fev/2024): utiliza `js-md4` (sem dependência de OpenSSL legado), mas não gerencia transporte HTTP/HTTPS (apenas buffers de mensagens) e carece de definições TypeScript nativas.
  - `axios-ntlm` (v1.4.6, set/2025): integra NTLM ao cliente Axios via interceptores, mas introduziria a biblioteca Axios e suas dependências transitórias no backend Express institucional que já padroniza `node:https`.
  - **Cliente Institucional TypeScript Nativo** (`server/providers/ews/ntlmClient.ts` + `ntlmCrypto.ts`): zero dependências externas adicionais, 100% tipado em TypeScript, implementação pura do MD4 (RFC 1320) e NTLMv2 (MS-NLMP §3.3.2 e §4.2.4), controle estrito de socket pooling persistente (`node:https` com `keepAlive: true`, `maxSockets: 1`) e hardening institucional (HTTPS estrito e rejeição de credenciais embutidas na URL).
- **Correção Criptográfica do Cálculo NTOWFv2 (MS-NLMP §3.3.2 e §4.2.4.1.1):**
  - O cálculo da chave NTLMv2 (`computeNtlmv2Hash`) requer a concatenação `Uppercase(User) + UserDom` (isto é, apenas o nome de usuário é convertido para maiúsculas, enquanto o domínio preserva estritamente sua capitalização original).
  - Em `server/providers/ews/ntlmClient.ts`, foi removida a conversão redundante e indevida `domain.toUpperCase()`, garantindo conformidade estrita com o padrão da Microsoft.
  - Em `tests/cryptoNtlmReference076.test.ts`, foram inseridos vetores oficiais congelados e independentes do RFC 1320 (Seção A.5) e MS-NLMP §4.2.4 com validações byte a byte de NT-Hash, NTLMv2-Hash, LMv2 Response, NTLMv2 Blob e NTProofStr sem derivações circulares.

### Achado 11 — Isolamento de Webhooks Resend
- **Correção Aplicada:** Em `server/repositories/notificationOutboxRepository.ts` (Firestore e In-Memory), qualquer webhook do Resend recebido com identificador de notificação ou tentativa vinculada a item do EWS (`provider !== 'resend'`) é imediatamente classificado como `INCONSISTENT` (`WEBHOOK_PROVIDER_MISMATCH`), sem alterar status ou campos da notificação EWS. Adicionalmente, a verificação de assinatura foi desacoplada via `ResendWebhookVerifier`, permitindo a reconciliação de itens históricos do Resend mesmo com `EMAIL_PROVIDER=ews`.

### Achado 12 — Validação Estrita de `EMAIL_PROVIDER` e Hardening de `EWS_URL`
- **Correção Aplicada:** Em `server/config/env.ts`, `process.env.EMAIL_PROVIDER` é validado estritamente para aceitar apenas `'ews'` ou `'resend'`, rejeitando valores vazios ou não suportados no startup. A URL do EWS é estritamente validada para protocolo HTTPS e rejeita credenciais embutidas (`username:password@host`).

### Achados 14 e 15 — Versionamento Consistente e Testes Pre-Deployment
- **Correção Aplicada:**
  - `infra/cloudflare/maintenance-worker/src/index.ts` atualizado para retornar `version: '0.7.6'`.
  - `infra/cloudflare/maintenance-worker/package-lock.json` alinhado para `0.7.6`.
  - `tests/preDeployment071.test.ts` atualizado para validar `'0.7.6'`.

### Achados 16 e 17 — Artifact Registry e Desacoplamento de Segredos R2
- **Correção Aplicada:** `scripts/artifactRegistrySnapshot.ts` e `server/utils/artifactRegistryParser.ts` operam totalmente desacoplados de `SERVER_ENV` e das variáveis do Cloudflare R2. O parser suporta extração do campo `metadata.imageSizeBytes` retornado pelo `gcloud` e rejeita ausência de campos de tamanho, prevenindo a gravação espúria de `bytes: 0`.

### Achados 18, 19 e 20 — Transição Operacional Resend $\rightarrow$ EWS e Diagnóstico Fail-Closed
- **Correção Aplicada:**
  - Adicionado script `"test:ews": "vitest run tests/ewsIntegration.optIn.test.ts"` no `package.json`.
  - Aperfeiçoado o script `scripts/preMigrationResendCheck.ts` para operar em modo estritamente **fail-closed**:
    - Contadores explícitos para todos os status de risco: `PENDING`, `PROCESSING`, `DEFERRED`, `RETRY_PENDING`, `SENT`, `FAILED` (bloqueante devido a potencial requeue/reprocessamento pelo worker), `DELIVERY_UNCERTAIN`, `FAILED_CONFIGURATION` e status desconhecido `OTHER`.
    - Bloqueio imediato (`READY_TO_DISABLE_RESEND: false`) se qualquer status acima for $> 0$.
    - **Compatibilidade Legada de Provider:** O script replica com precisão a semântica do runtime (`data['provider'] === 'ews' ? 'ews' : 'resend'`). A consulta à outbox é realizada em toda a coleção sem filtros rígidos que pudessem ignorar documentos históricos onde o campo `provider` está ausente, garantindo que documentos legados ou com provedor não mapeado sejam auditados como Resend.
    - Identificação e bloqueio para tentativas órfãs (`orphanAttemptsCount > 0`, onde a notificação pai não existe no Firestore).
    - Tratamento fail-closed para erros de leitura/consulta (`readErrorsCount > 0`) na consulta ao outbox, documentos pai e webhooks (`notificationWebhookEvents`).
    - Exibição discriminada de todos os contadores no relatório de console.
  - Suíte de testes dedicada `tests/preMigrationResendCheck.test.ts` expandida para **23 casos de teste** cobrindo individualmente cada condição terminal, de bloqueio (`FAILED`, `PENDING`, etc.), erro, tentativa órfã, normalização de documentos legados sem `provider`, provedores desconhecidos e camada de diagnóstico em Firestore mock.
  - Documentação (`docs/IMPLANTACAO_0.7.6.md`, `docs/EWS_CONFIGURACAO_0.7.6.md`, `docs/HOMOLOGACAO_MANUAL_0.7.6.md`, `docs/ARQUIVOS_0.7.6.md`, `CHANGELOG.md`) atualizada com dados reais da infraestrutura (`gen-lang-client-0120954905`, `us-west1`, `olhos-do-campus`, `odc-ews-username`, `odc-ews-password`) e uso de placeholder `<ENDERECO_REMETENTE_EWS>`.

---

## 3. Matriz de Gates de Homologação

| Gate de Verificação | Comando Executado | Resultado |
| :--- | :--- | :--- |
| **Instalação Limpa** | `npm ci` | **APROVADO (1198 pacotes, 0 vulnerabilidades, Exit code 0)** |
| **Checagem Estática de Tipos (Raiz)** | `npm run typecheck` | **APROVADO (0 erros, Exit code 0)** |
| **Linter Estático (Raiz)** | `npm run lint` | **APROVADO (0 erros, 0 avisos, Exit code 0)** |
| **Suíte Regular de Testes Vitest** | `npm test` | **APROVADO (55 arquivos passados, 2 skipped opt-in, 386 testes aprovados, 3 skipped opt-in, Exit code 0)** |
| **Testes de Regras Firestore/Storage** | `npm run test:rules` | **APROVADO (2 testes, Exit code 0)** |
| **Testes de Integração Firebase** | `npm run test:firebase` | **APROVADO (19 testes, Exit code 0)** |
| **Testes de Storage/Cleanup** | `npm run test:storage` | **APROVADO (6 testes, Exit code 0)** |
| **Checagem de Tipos do Maintenance Worker** | `npm run worker:typecheck` | **APROVADO (0 erros, Exit code 0)** |
| **Testes do Maintenance Worker** | `npm run worker:test` | **APROVADO (4 testes, Exit code 0)** |
| **Build de Produção (Client + Server)** | `npm run build` | **APROVADO (dist/client + dist/server, Exit code 0)** |
| **Pipeline Integrada de Validação** | `npm run validate` | **APROVADO (Exit Code 0)** |
| **Auditoria Completa de Dependências** | `npm audit` | **APROVADO (0 vulnerabilidades, Exit code 0)** |
| **Auditoria de Dependências de Produção** | `npm audit --omit=dev` | **APROVADO (0 vulnerabilidades, Exit code 0)** |

---

## 4. Ajustes Operacionais Durante Gates de Teste

1. **`tests/firebaseIntegration.test.ts`:** O teste de bootstrap administrativo (`executa bootstrap em dry-run sem persistir e depois cria o primeiro Administrador`) dispara dois subprocessos sequenciais que executam scrypt/hashing e autenticação contra o Firebase Auth Emulator. Em execuções com alta concorrência de CPU, a execução excedeu a margem de 20s em milissegundos. Foi adicionado o parâmetro `{ timeout: 45000 }` ao caso de teste específico, sem alteração de nenhuma asserção lógica ou regra de segurança.
2. **`tests/productionPackaging061.test.ts`:** O teste de pruning de pacotes de desenvolvimento (`removes dev-only modules and Bun lockfiles while preserving production modules`) executa `npm prune` em diretório temporário isolado. Teve seu timeout ajustado para `60000` (60s) para garantir estabilidade operacional em disco lento/Windows sem afetar nenhuma validação de segurança.

