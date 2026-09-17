# RELATÓRIO DE EXECUÇÃO DE TESTES — GATE 0.9-G.6

## Sistema Institucional de Manutenção da Infraestrutura Física — Olhos do Campus

### Ciclo 0.9.0 — Operações, Observabilidade, Backup/Restore, Release e Recuperação (G.6 / G.6C / G.6C2 / G.6C3)

---

## 1. Sumário Geral de Execução no Gate 0.9-G.6C3

Todas as baterias de validação estática, dinâmica, unitária, contratual, de scripts e de emuladores foram executadas com 100% de aprovação no ambiente de laboratório isolado (`lab-gate-09g6c3`):

| Bateria de Validação | Comando Executado | Status | Métricas e Cobertura Registradas |
| :--- | :--- | :---: | :--- |
| **Instalação Limpa de Dependências** | `npm ci` | **PASS** | 1.198 pacotes instalados deterministicamente a partir do `package-lock.json` |
| **Verificação Estática de Tipos** | `npm run typecheck` | **PASS** | `tsc --noEmit` completou com 0 erros |
| **Linter Estático de Código** | `npm run lint` | **PASS** | `eslint . --max-warnings=0` completou com 0 erros e 0 warnings |
| **Tipos do Worker Cloudflare** | `npm run worker:typecheck` | **PASS** | Verificação de tipos TypeScript do worker concluída com 0 erros |
| **Testes Unitários do Worker** | `npm run worker:test` | **PASS** | 4/4 testes aprovados no ambiente Cloudflare Workers |
| **Suíte Principal Vitest** | `npm run test` | **PASS** | 72 arquivos / 564 testes aprovados (0 falhas, 3 pulados por opt-in) |
| **Build de Produção (Client + Server)** | `npm run build` | **PASS** | Vite client (714 kB JS / 29 kB CSS) + Server esbuild (463 kB) |
| **Regras de Segurança Firestore/Storage** | `npm run test:rules` | **PASS** | 2/2 testes aprovados no Firebase Emulator local |
| **Integração Firebase Emulador** | `npm run test:firebase` | **PASS** | 19/19 testes aprovados no Firebase Emulator local |
| **Integração Storage Emulador** | `npm run test:storage` | **PASS** | 6/6 testes aprovados no Storage Emulator local |
| **Auditoria de Produção** | `npm audit --omit=dev` | **PASS** | **0 vulnerabilidades encontradas (found 0 vulnerabilities)** |
| **Verificação de Identidade de Release** | `npm run verify:release` | **PASS** | 10/10 pontos de verdade sincronizados em 0.9.0 (`RELEASE_IDENTITY_TEST=PASS`) |
| **Guard de Scale-Out e Capacidade** | `npm run check:scale` | **PASS** | Fail-closed verificado contra `deployCloudRun.sh` (`MAX_SCALE_GUARD_TEST=PASS`) |

---

## 2. Testes Específicos das Remediações do Gate 0.9-G.6C3

### 2.1. G09G6R-F001 — Firestore Named Database (`tests/firestoreBackupCommands.test.ts`)
* **Comando**: `npx vitest run tests/firestoreBackupCommands.test.ts`
* **Status**: **PASS (14/14 testes)**
* **Asserções Validadas**:
  1. `scripts/backup/firestoreBackup.sh` existe.
  2. Falha (fail-closed) quando `FIRESTORE_DATABASE_ID` está ausente.
  3. Falha quando `FIRESTORE_PROJECT_ID` está ausente.
  4. Falha quando `BACKUP_BUCKET` não começa com `gs://`.
  5. Em dry-run inclui flag `--database="(default)"` com banco padrão.
  6. Em dry-run inclui flag `--database="infra-named-db-01"` com named database customizado.
  7. Rejeita `--apply` sem token de segurança `ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP`.
  8. `scripts/backup/firestoreRestore.sh` existe.
  9. Falha (fail-closed) quando `TARGET_FIRESTORE_DATABASE_ID` está ausente.
  10. Falha quando `TARGET_PROJECT` está ausente.
  11. Em dry-run inclui flag `--database="(default)"` no restore de destino padrão.
  12. Em dry-run inclui flag `--database="staging-custom-db"` no restore de destino nomeado.
  13. Bloqueia tentativa de restore se `TARGET_PROJECT` for igual ao de produção.
  14. Bloqueia restore se confirmação de backup pré-restore (`PRE_RESTORE_BACKUP_CONFIRMED=YES`) estiver ausente.

### 2.2. G09G6R-F002 — Cloud Run Scale Guard & Wrapper Canônico (`tests/scaleConfigGuard.test.ts`)
* **Comandos**: `npm run check:scale` e `npx vitest run tests/scaleConfigGuard.test.ts`
* **Status**: **PASS (21/21 testes)**
* **Asserções Validadas**:
  1. `scripts/deployCloudRun.sh` existe e é legível.
  2. Fixa explicitamente `max-instances=1` na linha de comando de deploy do Cloud Run.
  3. Opera em modo DRY-RUN por padrão.
  4. Exige token `ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_0_9` para deploy real.
  5. `cloudbuild.yaml` existe e não contém `max-instances > 1`.
  6. Não menciona `CLOUD_ARMOR_ENABLED` de forma contraditória.
  7. `server/middleware/rateLimit.ts` documenta `RATE_LIMIT_SCOPE=INSTANCE_LOCAL`.
  8. Documenta `CURRENT_PRODUCTION_MAXSCALE=1`.
  9. Documenta `REQUIRES_DISTRIBUTED_OR_EDGE_LIMIT_BEFORE_SCALE_OUT=YES`.
  10. Documenta `SAFE_FOR_CURRENT_TOPOLOGY=YES`.
  11. `package.json` define script `check:scale`.
  12. Script referencia `checkScaleConfig.mjs`.
  13. `scripts/checkScaleConfig.mjs` existe e detecta max-instances.
  14. Emite labels formais de invariante (`MAX_SCALE_1_SECURITY_INVARIANT=YES`, `SCALE_OUT_ALLOWED=NO`).
  15. Execução direta com topologia canônica retorna status 0 (`STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)`).
  16. Fail-closed: se `max-instances` for omitido na configuração de deploy, encerra imediatamente com status 1.

### 2.3. G09G6R-F003 — Sanitização Recursiva de Logs (`tests/structuredLogging.test.ts`)
* **Comando**: `npx vitest run tests/structuredLogging.test.ts`
* **Status**: **PASS (17/17 testes)**
* **Asserções Validadas**:
  1. Emissão de JSON válido para `logger.info`.
  2. Emissão de JSON válido para `logger.error`.
  3. Mapeamento estrito de severidades (DEBUG, INFO, WARNING, ERROR, CRITICAL).
  4. Inclusão de `requestId` quando fornecido.
  5. Inclusão de campos operacionais seguros (`errorCode`, `status`, `durationMs`).
  6. Ausência de campos proibidos quando nenhum extra é passado.
  7. Ausência de campos proibidos quando extras seguros são passados.
  8. Presença obrigatória de `severity` e `event`.
  9. Mapeamento de `logger.warn` para `WARNING`.
  10. Mapeamento de `logger.critical` para `CRITICAL`.
  11. Redação de todas as chaves sensíveis em estruturas planas e aninhadas (`authorization`, `token`, `trackingKey`, `email`, `description`, `internalNote`, `note`, `ip`, `cookie`, `set-cookie`).
  12. Insensibilidade a maiúsculas/minúsculas nas chaves sensíveis.
  13. Redação de chaves sensíveis dentro de arrays de objetos.
  14. Proteção contra referências circulares (`[CIRCULAR]`) sem lançar exceção.
  15. Limitação de profundidade excessiva com marcador `[MAX_DEPTH]`.
  16. Sanitização de instâncias de `Error` com metadados confidenciais.
  17. Emissão fim-a-fim de log para stdout via JSON serializado mesmo com dados sensíveis e grafos cíclicos.

---

## 3. Rehearsals de Recuperação, Backup e Carga

### 3.1. Rehearsal Firestore (`scripts/backup/rehearsalFirestore.ts`)
* **Comando**: `firebase emulators:exec --only auth,firestore,storage "npx tsx scripts/backup/rehearsalFirestore.ts"`
* **Resultado**: `FIRESTORE_RESTORE_REHEARSAL=PASS` (100% dos documentos sintéticos recuperados).

### 3.2. Rehearsal R2 (`scripts/backup/rehearsalR2.ts`)
* **Comando**: `npx tsx scripts/backup/rehearsalR2.ts`
* **Resultado**: `PHOTO_RESTORE_REHEARSAL=PASS` (5/5 fotos restauradas com integridade SHA-256 idêntica — `PHOTO_RESTORE_REHEARSAL_OBJECTS=5`).

### 3.3. Rehearsal de Migração (`scripts/backup/rehearsalMigration.ts`)
* **Comando**: `firebase emulators:exec --only auth,firestore,storage "npx tsx scripts/backup/rehearsalMigration.ts"`
* **Resultado**: `MIGRATION_RECOVERY_REHEARSAL=PASS` (100% MATCH entre estado pré-migração e estado recuperado a partir da pré-imagem, zero `any` no código).

### 3.4. Teste de Carga de Instância Única (`scripts/singleInstanceLoadTest.ts`)
* **Comando**: `npx tsx scripts/singleInstanceLoadTest.ts`
* **Classificação**: `SINGLE_INSTANCE_LOAD_TEST=LIMITED`
* **Resultados**:
  - `/api/health`: 500 requisições, concorrência 10, 100% sucesso, p50 = 16.31 ms, p95 = 64.66 ms.
  - `/api/config`: 300 requisições, concorrência 10, 100% sucesso, p50 = 19.99 ms, p95 = 25.06 ms.
  - `LOAD_TEST_ARBITRARY_SLA_THRESHOLD_REMOVED=YES`.