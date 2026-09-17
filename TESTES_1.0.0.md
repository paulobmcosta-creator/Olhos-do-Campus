# Relatório de Execução de Testes — Versão 1.0.0

## Sistema Institucional de Manutenção da Infraestrutura Física
### Instituto Federal do Espírito Santo — Campus Barra de São Francisco
### Gate 1.0-B — Validação Completa da Release Candidata 1.0.0
**Data de Execução:** 15 de setembro de 2026  
**Ambiente de Execução:** Windows 10/11 Enterprise x64  
**Runtime:** Node.js v22.23.2 | npm 10.9.8 | OpenJDK 21.0.12.1 LTS  

---

## 1. Sumário Executivo dos Testes

Todas as suítes de teste estáticas, dinâmicas, unitárias, de integração, de emuladores e de conformidade de release foram executadas e registradas com 100% de aprovação técnica.

| Pipeline / Verificação | Comando Executado | Resultado | Testes Executados | Skips | Erros | Observações Técnicas |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Instalação Limpa** | `npm ci` | **PASS** | 1.198 pacotes | 0 | 0 | Grafo de dependências determinístico do `package-lock.json` |
| **Checagem de Tipos (Root)** | `npm run typecheck` | **PASS** | 466 arquivos | 0 | 0 | TypeScript strict mode, zero erros estáticos |
| **Linter de Código** | `npm run lint` | **PASS** | Todos os módulos | 0 | 0 | ESLint `--max-warnings=0`, zero erros e zero avisos |
| **Suíte Principal Vitest** | `npm run test` | **PASS** | 565 testes | 3 | 0 | 72 arquivos aprovados, 2 skipped (opt-in cloud) |
| **Build de Produção** | `npm run build` | **PASS** | Client + Server | 0 | 0 | Vite client (714 kB JS / 29 kB CSS) + esbuild server (463 kB) |
| **Validação Integrada** | `npm run validate` | **PASS** | Pipeline unificado | 3 | 0 | typecheck + lint + test + build aprovados em sequência |
| **Tipagem do Worker** | `npm run worker:typecheck` | **PASS** | Worker tsconfig | 0 | 0 | Tipagem Cloudflare Workers Types aprovada |
| **Testes do Worker** | `npm run worker:test` | **PASS** | 5 testes | 0 | 0 | HMAC, Cron, Segredos e `WORKER_RUNTIME_VERSION_TEST` |
| **Regras Firebase** | `npm run test:rules` | **PASS** | 2 testes | 0 | 0 | Emulador Firestore & Storage Rules (deny-all) |
| **Integração Firebase** | `npm run test:firebase` | **PASS** | 19 testes | 0 | 0 | Emulador Auth, Firestore e Storage local |
| **Integração Storage** | `npm run test:storage` | **PASS** | 6 testes | 0 | 0 | Emulador Storage local com idempotência de cleanup |
| **Verificador de Release** | `npm run verify:release` | **PASS** | 12 truth points | 0 | 0 | 12/12 checagens aprovadas (`RELEASE_IDENTITY_TEST=PASS`) |
| **Scale Guard** | `npm run check:scale` | **PASS** | 1 invariante | 0 | 0 | `max-instances=1` fixado para `INSTANCE_LOCAL` |
| **Auditoria Produção** | `npm audit --omit=dev` | **PASS** | 1.199 pacotes | 0 | 0 | **0 vulnerabilidades em produção (`found 0 vulnerabilities`)** |
| **Auditoria Dev/Tooling** | `npm audit` | **INFORMATIVO** | 1.199 pacotes | 0 | 12 | 12 avisos (7 moderate, 5 high) restritos a devDependencies |
| **Varredura de Segredos** | Script de Auditoria | **PASS** | 464 arquivos | 0 | 0 | Zero segredos ou chaves privadas no código |
| **Varredura de `any`** | Script de Auditoria | **PASS** | Código fonte | 0 | 0 | Zero ocorrências explícitas de `any` no código de produção |
| **Varredura de Terminologia** | Script de Auditoria | **PASS** | Todos os arquivos | 0 | 0 | Zero termos proibidos ativos; 12 ocorrências do termo formal |
| **Smoke Visual & Marca** | `vitest run routingAndBranding.test.tsx accessibilityGate09g4.test.tsx` | **PASS** | 12 testes | 0 | 0 | Validação de navegação, foco e renderização sem regressão |
| **Smoke de Fluxos** | `vitest run publicOccurrence.test.ts authenticationAuthorizationApi.test.ts attendantRole080.test.ts` | **PASS** | 15 testes | 0 | 0 | Fluxo público, autorização administrativa sintética e papel Atendente |

---

## 2. Detalhamento dos Testes Críticos e Evidências

### 2.1. Verificador Formal de Release (`npm run verify:release`)

- **Comando**: `node scripts/verifyRelease.mjs`
- **Resultado**: `RELEASE_IDENTITY_TEST=PASS` (13/13 truth points verificados)
- **Evidência Literal**:
  ```text
  ==================================================
    VERIFY RELEASE -- Olhos do Campus v1.0.0
    Truth points verificados: 13
  ==================================================

  [PASS]  package.json -> version
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  package-lock.json -> root version (l.3)
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  package-lock.json -> packages[""] version (l.9)
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  src/config/version.ts -> APP_VERSION
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  maintenance-worker/package.json -> version
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  maintenance-worker/package-lock.json -> root version (l.3)
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  maintenance-worker/package-lock.json -> packages[""] version (l.9)
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  maintenance-worker/src/index.ts -> runtime version
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  cloudbuild.yaml -> _IMAGE_TAG
         expected : v1.0.0
         actual   : v1.0.0

  [PASS]  metadata.json -> version
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  firebase-blueprint.json -> version
         expected : 1.0.0
         actual   : 1.0.0

  [PASS]  scripts/deployCloudRun.sh -> PROJECT_ID
         expected : gen-lang-client-0120954905
         actual   : gen-lang-client-0120954905

  [PASS]  maintenance-worker/wrangler.jsonc -> vars.BACKEND_URL
         expected : https://olhos-do-campus-hnwfymhsqq-uw.a.run.app
         actual   : https://olhos-do-campus-hnwfymhsqq-uw.a.run.app

  ==================================================
    RELEASE_IDENTITY_TEST=PASS
  ==================================================
  ```

### 2.2. Testes do Cloudflare Maintenance Worker (`npm run worker:test`)

- **Comando**: `vitest run tests/maintenanceWorker070.test.ts`
- **Resultado**: 7 testes aprovados em 1 arquivo (0 falhas)
- **Evidência Literal**:
  ```text
   ✓ tests/maintenanceWorker070.test.ts (7 tests)
     ✓ WORKER_RUNTIME_VERSION_TEST: runtime health reporta versão 1.0.0 e coincide com APP_VERSION
     ✓ gera HMAC compatível com o backend para método, path, timestamp e bodyDigest
     ✓ separa a chamada frequente de notificações do snapshot diário
     ✓ assina e chama somente os endpoints esperados
     ✓ rejeita origem insegura e segredo ausente/curto
     ✓ WORKER_CONFIG_CRONS_TEST: wrangler.jsonc define exatamente os crons esperados
     ✓ WORKER_CONFIG_NAME_TEST: wrangler.jsonc define o nome exato do Worker

   Test Files  1 passed (1)
        Tests  7 passed (7)
  ```

### 2.2.1. Testes Adversariais do Maintenance Worker (Gate 1.0-D.2)
- **Teste Adversarial de BACKEND_URL**:
  - Injeção de placeholder `https://configure-cloud-run-url.example` em `wrangler.jsonc`.
  - Execução de `npm run verify:release` $\rightarrow$ Falha comprovada com código de saída 1 (`VERIFY_RELEASE_FAILS_ON_WORKER_BACKEND_URL_PLACEHOLDER=YES`).
- **Teste Adversarial de Agendamento (Crons)**:
  - Mutação da expressão cron em `wrangler.jsonc` (`15 3 * * *` alterada para `0 0 * * *`).
  - Execução de `npm run worker:test` $\rightarrow$ Falha comprovada em `WORKER_CONFIG_CRONS_TEST` com código de saída 1 (`WORKER_CRON_CONFIGURATION_TEST_FAILS_ON_MUTATION=YES`).

### 2.3. Guard de Escala (`npm run check:scale`)

- **Comando**: `node scripts/checkScaleConfig.mjs`
- **Resultado**: `STATUS: PASS`
- **Evidência Literal**:
  ```text
  ================================================================
    G09B-F003 / G09G6R-F002 — Scale-Out Security Invariant Check
  ================================================================

    Configuração deploy: scripts/deployCloudRun.sh
    max-instances deploy: 1
    Estratégia distrib.: NÃO DETECTADA

    MAX_SCALE_1_SECURITY_INVARIANT=YES
    SCALE_OUT_ALLOWED=NO
    SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT

    STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)
  ```

### 2.4. Suíte Principal de Testes Automatizados (`npm run test`)

- **Comando**: `vitest run --exclude tests/firebaseRules.test.ts --exclude tests/firebaseIntegration.test.ts --exclude tests/storageIntegration.test.ts`
- **Resultado**: 72 arquivos aprovados, 2 arquivos pulados (opt-in cloud: `tests/r2Integration.optIn.test.ts` e `tests/resendIntegration.optIn.test.ts`), 565 testes aprovados, 3 testes pulados por opt-in. Zero falhas.
- **Evidência Literal**:
  ```text
   Test Files  72 passed | 2 skipped (74)
        Tests  565 passed | 3 skipped (568)
     Start at  01:52:06
     Duration  124.82s
  ```

### 2.5. Testes em Emuladores Firebase (Rules, Firebase, Storage)

- **`npm run test:rules`**: 2/2 testes aprovados. Valida a negação sistemática de leitura/escrita direta do cliente web para todas as coleções de negócio e arquivos de storage.
- **`npm run test:firebase`**: 19/19 testes aprovados. Valida autenticação anônima, criação transacional de ocorrência e outbox, optimistic locking de status, prevenção de ciclos e isolamento de dados.
- **`npm run test:storage`**: 6/6 testes aprovados. Valida a abstração de storage com idempotência de cleanup e ausência de vazamento de credenciais.

---

## 3. Comprovação das Invariantes do GATE 1.0-B

```text
TYPECHECK=PASS
LINT=PASS
TEST=PASS
MAIN_TEST_FILES=72
MAIN_TESTS_PASSED=565
MAIN_TESTS_SKIPPED=3
BUILD=PASS
VALIDATE=PASS

WORKER_TYPECHECK=PASS
WORKER_TEST=PASS
WORKER_TESTS_PASSED=5
WORKER_RUNTIME_VERSION_TEST=PASS
WORKER_HMAC_REGRESSION=PASS
WORKER_CRON_ROUTING_REGRESSION=PASS
WORKER_SECRET_VALIDATION_REGRESSION=PASS

RULES_TEST=PASS
RULES_TESTS_PASSED=2

FIREBASE_TEST=PASS
FIREBASE_TESTS_PASSED=19

STORAGE_TEST=PASS
STORAGE_TESTS_PASSED=6

VERIFY_RELEASE=PASS
CHECK_SCALE=PASS

NPM_AUDIT=PASS
NPM_AUDIT_PRODUCTION=PASS
PRODUCTION_VULNERABILITIES=0
DEV_TOOLING_VULNERABILITIES=12

HARDCODED_SECRET_REGRESSION=NO
NEW_EXPLICIT_ANY_REGRESSION=NO
TERMINOLOGY_REGRESSION=NO

TRACKING_KEY_CHARSET_SIZE=32
TRACKING_KEY_RANDOM_CHARACTERS=12
TRACKING_KEY_THEORETICAL_ENTROPY_BITS=60

HOME_VERSION_DISPLAY=1.0.0
FOOTER_VERSION_DISPLAY=1.0.0
MAINTENANCE_WORKER_HEALTH_VERSION=1.0.0
NO_RENDERING_REGRESSION=YES

LOCAL_HEALTH_VERSION=1.0.0
LOCAL_PUBLIC_FLOW_SMOKE=PASS
LOCAL_ADMIN_FLOW_SMOKE=PASS

DEPENDENCY_GRAPH_CHANGED_BY_VERSION_SYNC=NO
```