# MATRIZ DE RASTREABILIDADE DE FINDINGS — GATE 0.9-G.6

## Sistema Institucional de Manutenção da Infraestrutura Física — Olhos do Campus

### Ciclo 0.9.0 — Operações, Observabilidade, Backup/Restore, Release e Recuperação (G.6 / G.6C / G.6C2 / G.6C3)

---

## 1. Controle de Custódia e Identidade de Artefatos

| Parâmetro | Valor Registrado |
| :--- | :--- |
| **Data de Execução** | 14/09/2026 |
| **Ambiente de Trabalho** | Laboratório Isolado (`lab-gate-09g6c3`) |
| **Fonte de Verdade de Entrada** | `olhos-do-campus-0.9.0-g6c2.zip` |
| **SHA-256 Esperado de Entrada** | `81E676BEA65DF3296990E16AF8632736265F049C5132F8EC9C36F8CAE543293F` |
| **SHA-256 Calculado de Entrada** | `81E676BEA65DF3296990E16AF8632736265F049C5132F8EC9C36F8CAE543293F` (**PASS**) |
| **Artefato Produzido** | `olhos-do-campus-0.9.0-g6c3.zip` |
| **Status do Gate G.6C3** | **IMPLEMENTATION_COMPLETE (AWAITING INDEPENDENT AUDIT G.6R2)** |

---

## 2. Matriz de Correção de Findings da Auditoria Independente 0.9-G.6R

| Finding Audit | Severidade | Estado Entrada | Ação Realizada no Gate 0.9-G.6C3 | Testes e Evidências | Estado Saída Registrado |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **G09G6R-F001** | HIGH | `OPEN` | Suporte a named databases no Cloud Firestore. Adicionadas as variáveis obrigatórias `FIRESTORE_DATABASE_ID` em `scripts/backup/firestoreBackup.sh` e `TARGET_FIRESTORE_DATABASE_ID` em `scripts/backup/firestoreRestore.sh`. Inclusão mandatória da flag `--database="<banco>"` em todos os comandos `gcloud firestore export/import`. Fail-closed estrito contra omissão de banco. Documentação em `.env.example` e `docs/RUNBOOK_BACKUP_RESTORE_0.9.0.md`. | `tests/firestoreBackupCommands.test.ts` (14 testes PASS). Rehearsal firestore aprovado (`FIRESTORE_RESTORE_REHEARSAL=PASS`). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09G6R-F002** | MEDIUM | `OPEN` | Eliminação da premissa permissiva em scale-out. Criação do wrapper canônico `scripts/deployCloudRun.sh` com `--max-instances=1` explícito. Refatoração de `scripts/checkScaleConfig.mjs` para inspecionar `scripts/deployCloudRun.sh` e falhar fechado (`exit(1)`) se `max-instances` estiver ausente ou omitido (não assumindo mais o padrão 1, pois o default de Cloud Run é 100). Atualização dos runbooks e políticas. | `npm run check:scale` (PASS), `tests/scaleConfigGuard.test.ts` (21 testes PASS). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09G6R-F003** | LOW | `OPEN` | Sanitização recursiva profunda de dados sensíveis em `server/utils/logger.ts`. Implementação de `redactSensitive` abrangendo objetos aninhados, arrays e erros com chaves `authorization`, `token`, `trackingKey`, `email`, `description`, `internalNote`, `note`, `ip`, `cookie`, `set-cookie` (case-insensitive). Proteção contra referências circulares via `WeakSet` (`[CIRCULAR]`) e limite de recursão a 10 níveis (`[MAX_DEPTH]`). | `tests/structuredLogging.test.ts` (17 testes PASS cobrindo estruturas planas, aninhadas, arrays, cyclic graph, erros e depth limit). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |

---

## 3. Matriz Canônica dos 7 Findings do Gate G.6 (Preservação Canônica)

| Finding / ID | Severidade | Estado Entrada | Ação Realizada no Ciclo G.6 | Estado Saída Registrado |
| :--- | :---: | :---: | :--- | :---: |
| **G09B-F003** | MEDIUM | `MITIGATED_AWAITING_INDEPENDENT_REVIEW` | Invariante `MAX_SCALE_1_SECURITY_INVARIANT=YES` fixada em `deployCloudRun.sh` e guard `checkScaleConfig.mjs`. Benchmark local `SINGLE_INSTANCE_LOAD_TEST=LIMITED`. | `MITIGATED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F008** | HIGH operacional | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` | Runbook `docs/RUNBOOK_BACKUP_RESTORE_0.9.0.md` com RPO/RTO mantidos como `DECISION_REQUIRED`. Scripts seguros com named database e rehearsals automatizados aprovados. | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F010** | LOW | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` | Identidade de release na versão canônica `0.9.0` em 10 pontos da árvore. `RELEASE_IDENTITY_TEST=PASS` (10/10). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F011** | INFORMATIONAL | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` | Sincronização estrita dos metadados nos lockfiles sem alteração no grafo (`DEPENDENCY_GRAPH_CHANGED_BY_VERSION_SYNC=NO`). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F012** | LOW | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` | Structured logging `server/utils/logger.ts` com sanitização recursiva profunda contra vazamento de dados sensíveis. | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F013** | INFORMATIONAL | `DECISION_DOCUMENTED_AWAITING_INDEPENDENT_REVIEW` | ADR de região com `southamerica-east1`, imutabilidade do Firestore documentada e `REGION_DECISION=MIGRATION_RECOMMENDED_POST_1_0`. | `DECISION_DOCUMENTED_AWAITING_INDEPENDENT_REVIEW` |
| **G09B-F014** | LOW | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` | Guard `BACKUP_CONFIRMED=CONFIRM_BACKUP_PRE_MIGRATION` em `scripts/migrate080.ts`, extrator de pré-imagem `migrationManifest.ts` e rehearsal com 100% de recuperação exata e 0 `any` (`MIGRATION_RECOVERY_REHEARSAL=PASS`). | `IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW` |

---

## 4. Matriz de Regressão dos Gates Anteriores (G.1 a G.5)

| Gate de Origem | Escopo | Testes de Regressão Executados | Resultado |
| :--- | :--- | :--- | :---: |
| **Gate 0.9-G.1** | Segurança, Rate Limiting, CSP, HMAC, Secrets e Timing Attacks | `tests/securityRemediationG1.test.ts` (15 testes), `tests/trackingKey.test.ts` (6 testes), `tests/maintenanceSignatureApi070.test.ts` (8 testes), `tests/maintenanceWorker070.test.ts` (4 testes), `tests/staticPolicy.test.ts` (14 testes). | `G1_SECURITY_REGRESSION=PASS` |
| **Gate 0.9-G.2** | RBAC, Menor Privilégio e Segregação de Papéis | `tests/adminAssigneesRbac.test.ts` (9 testes), `tests/adminAssigneesFrontendRbac.test.tsx`, `tests/adminAuthorization.test.ts` (4 testes), `tests/adminRoles060.test.ts` (3 testes), `tests/adminUserRepository.test.ts` (5 testes). | `G2_RBAC_REGRESSION=PASS` |
| **Gate 0.9-G.3** | Funcionalidades, Normalização de Busca e Concorrência | `tests/searchNormalizationG3.test.ts` (7 testes), `tests/transitionConcurrencyG3.test.tsx` (4 testes), `tests/occurrenceService.test.ts` (6 testes), `tests/occurrenceStateMachine.test.ts` (5 testes), `tests/sla060.test.ts` (14 testes). | `G3_FUNCTIONAL_REGRESSION=PASS` |
| **Gate 0.9-G.4** | Acessibilidade WCAG 2.2 AA e Navegação por Teclado | `tests/accessibilityGate09g4.test.tsx` (8 testes), `tests/brandImage.test.tsx` (1 teste), `tests/routingAndBranding.test.tsx` (4 testes). | `G4_ACCESSIBILITY_REGRESSION=PASS` |
| **Gate 0.9-G.5** | UX, Responsividade e Adaptação em 11 Viewports | `tests/gate09g5ResponsiveUx.test.tsx` (25 testes cobrindo mobile, tablets e 11 viewports canônicos — `G5_SPECIFIC_TEST_COUNT=25`). | `G5_UX_REGRESSION=PASS` |

---

## 5. Parâmetros e Regras de Governança

```text
G1_SECURITY_REGRESSION=PASS
G2_RBAC_REGRESSION=PASS
G3_FUNCTIONAL_REGRESSION=PASS
G4_ACCESSIBILITY_REGRESSION=PASS
G5_UX_REGRESSION=PASS
G5_SPECIFIC_TEST_COUNT=25
G5_TEST_COUNT_DOCUMENTATION_CORRECTED=YES

G09G6R_F001=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09G6R_F002=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09G6R_F003=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW

G09B_F003=MITIGATED_AWAITING_INDEPENDENT_REVIEW
G09B_F008=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09B_F010=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09B_F011=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09B_F012=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW
G09B_F013=DECISION_DOCUMENTED_AWAITING_INDEPENDENT_REVIEW
G09B_F014=IMPLEMENTED_AWAITING_INDEPENDENT_REVIEW

MAX_SCALE_1_SECURITY_INVARIANT=YES
SCALE_OUT_ALLOWED=NO
SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT
RELEASE_IDENTITY_TEST=PASS
STRUCTURED_LOGGING_TEST=PASS
SENSITIVE_LOG_REDACTION_TEST=PASS
MAX_SCALE_GUARD_TEST=PASS
BACKUP_RESTORE_REHEARSAL_TEST=PASS
MIGRATION_RECOVERY_REHEARSAL_TEST=PASS
ENV_DOCUMENTATION_TEST=PASS
WINDOWS_FLAKE_TEST=PASS
G6_FORMAL_DOCS_IN_PROJECT_TREE=YES
G6_FORMAL_DOCS_IN_FINAL_ZIP=YES
GATE_0_9_G_6C3=IMPLEMENTATION_COMPLETE
READY_FOR_G_6R2=YES
READY_FOR_GATE_H=NO
```