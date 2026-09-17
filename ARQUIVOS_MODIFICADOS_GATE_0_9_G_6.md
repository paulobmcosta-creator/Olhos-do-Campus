# ARQUIVOS MODIFICADOS — GATE 0.9-G.6

## Sistema Institucional de Manutenção da Infraestrutura Física — Olhos do Campus

### Ciclo 0.9.0 — Operações, Observabilidade, Backup/Restore, Release e Recuperação (G.6 / G.6C / G.6C2 / G.6C3)

---

## 1. Resumo Quantitativo — Ciclo 0.9-G.6C3

| Categoria | Quantidade | Observação |
| :--- | :---: | :--- |
| **Artefato de Entrada (`0.9.0-g6c2.zip`)** | 458 | SHA-256 verificado: `81E676BEA65DF3296990E16AF8632736265F049C5132F8EC9C36F8CAE543293F` |
| **Arquivos Novos Adicionados no G.6C3** | 2 | `scripts/deployCloudRun.sh`, `tests/firestoreBackupCommands.test.ts` |
| **Arquivos Removidos do Repositório** | 0 | Nenhuma exclusão realizada |
| **Arquivos Existentes Modificados no G.6C3** | 12 | 2 scripts de backup, 1 guard de scale, 1 logger, 2 arquivos de teste, 1 env.example, 3 runbooks/políticas, 4 docs de governança |
| **Arquivos Finais no Pacote (`0.9.0-g6c3.zip`)** | 460 | 458 originais + 2 novos arquivos (excluindo diretórios efêmeros/testes de ambiente) |

---

## 2. Listagem Formal de Arquivos no Gate 0.9-G.6C3

```text
FILES_ADDED_G6C3=scripts/deployCloudRun.sh,tests/firestoreBackupCommands.test.ts
FILES_MODIFIED_G6C3=.env.example,ARQUIVOS_MODIFICADOS_GATE_0_9_G_6.md,docs/RUNBOOK_BACKUP_RESTORE_0.9.0.md,docs/RUNBOOK_RELEASE_0.9.0.md,docs/SCALE_OUT_POLICY_0.9.0.md,MATRIZ_FINDINGS_GATE_0_9_G_6.md,RELATORIO_GATE_0_9_G_6.md,scripts/backup/firestoreBackup.sh,scripts/backup/firestoreRestore.sh,scripts/checkScaleConfig.mjs,server/utils/logger.ts,TESTES_GATE_0_9_G_6.md,tests/scaleConfigGuard.test.ts,tests/structuredLogging.test.ts
FILES_REMOVED_G6C3=
```

---

## 3. Detalhamento dos Arquivos Adicionados no Gate 0.9-G.6C3 (2 arquivos)

1. **`scripts/deployCloudRun.sh`** (G09G6R-F002):
   - Wrapper canônico de deploy no Cloud Run para a API institucional.
   - Fixa explicitamente o parâmetro `--max-instances=1` (invariante de segurança `MAX_SCALE_1_SECURITY_INVARIANT=YES`).
   - Opera em modo `DRY-RUN=true` por padrão, exibindo o comando exato formatado.
   - Exige autorização formal e o token `ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_0_9` para execução com `--apply`.

2. **`tests/firestoreBackupCommands.test.ts`** (G09G6R-F001):
   - 14 asserções de validação comportamental para os scripts `firestoreBackup.sh` e `firestoreRestore.sh`.
   - Testa exigência mandatória de `FIRESTORE_DATABASE_ID` e `TARGET_FIRESTORE_DATABASE_ID` (fail-closed contra omissão).
   - Testa inclusão da flag `--database="<id>"` tanto para `(default)` quanto para named databases customizados.
   - Testa bloqueio de restauração em produção e exigência de tokens de confirmação de segurança.

---

## 4. Detalhamento dos Arquivos Modificados no Gate 0.9-G.6C3

1. **`scripts/backup/firestoreBackup.sh`** (G09G6R-F001):
   - Adicionada exigência mandatória da variável de ambiente `FIRESTORE_DATABASE_ID`.
   - Adicionada flag `--database="$DATABASE"` no comando `gcloud firestore export`.
   - Exibição de `Banco: $DATABASE` no output do script e no template de execução em dry-run.

2. **`scripts/backup/firestoreRestore.sh`** (G09G6R-F001):
   - Adicionada exigência mandatória da variável de ambiente `TARGET_FIRESTORE_DATABASE_ID`.
   - Adicionada flag `--database="$TARGET_DATABASE"` no comando `gcloud firestore import`.
   - Exibição de `Banco: $TARGET_DATABASE` no output e no template de execução em dry-run.

3. **`scripts/checkScaleConfig.mjs`** (G09G6R-F002):
   - Redefinida a fonte de verdade canônica de deploy para `scripts/deployCloudRun.sh`.
   - Implementado comportamento **fail-closed**: se `max-instances` estiver ausente ou não for detectado, o script encerra imediatamente com `exit(1)` (rejeitando a premissa de que a omissão equivale a 1, já que o default do Cloud Run é 100).
   - Mantida a checagem complementar em `cloudbuild.yaml`.

4. **`server/utils/logger.ts`** (G09G6R-F003):
   - Implementada função exportada `redactSensitive(value, seen, depth)`.
   - Sanitização recursiva profunda para chaves sensíveis: `authorization`, `token`, `trackingKey`, `email`, `description`, `internalNote`, `note`, `ip`, `cookie`, `set-cookie` (insensível a maiúsculas/minúsculas).
   - Proteção contra referência circular utilizando `WeakSet` (emite `[CIRCULAR]`).
   - Proteção contra estouro de pilha limitando a profundidade a 10 níveis (emite `[MAX_DEPTH]`).
   - Aplicação da redação estrita a todos os campos antes da serialização para stdout.

5. **`tests/scaleConfigGuard.test.ts`** (G09G6R-F002):
   - Expandido para 21 testes unitários.
   - Verifica existência do wrapper canônico `scripts/deployCloudRun.sh`, fixação de `max-instances=1`, dry-run padrão, token de segurança e execução íntegra do guard.

6. **`tests/structuredLogging.test.ts`** (G09G6R-F003):
   - Expandido de 10 para 17 testes unitários.
   - Valida redação em objetos planos e aninhados, insensibilidade a caixa alta/baixa, arrays de objetos, referências circulares, instâncias de `Error` e limite de profundidade.

7. **`.env.example`** (G09G6R-F001):
   - Documentadas as variáveis de ambiente operacionais de backup e restore: `FIRESTORE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `BACKUP_BUCKET`, `TARGET_PROJECT`, `TARGET_FIRESTORE_DATABASE_ID`.

8. **`docs/RUNBOOK_BACKUP_RESTORE_0.9.0.md`** (G09G6R-F001):
   - Atualizada a Seção 3 (Variáveis de Ambiente Necessárias) e Seção 9.1 (Restore Firestore) com `FIRESTORE_DATABASE_ID` e `TARGET_FIRESTORE_DATABASE_ID`.

9. **`docs/RUNBOOK_RELEASE_0.9.0.md`** (G09G6R-F002):
   - Atualizada a Etapa 5 (Deploy no Cloud Run) para documentar o uso obrigatório do wrapper canônico `scripts/deployCloudRun.sh`.
   - Adicionada referência ao script nas referências finais.

10. **`docs/SCALE_OUT_POLICY_0.9.0.md`** (G09G6R-F002):
    - Atualizada referência documental para incluir `scripts/deployCloudRun.sh` como mecanismo de fixação de `max-instances=1`.

11. **Documentos de Governança na Raiz (`ARQUIVOS_MODIFICADOS_...`, `MATRIZ_FINDINGS_...`, `RELATORIO_...`, `TESTES_...`)**:
    - Sincronizados com as evidências e parâmetros do Gate 0.9-G.6C3.