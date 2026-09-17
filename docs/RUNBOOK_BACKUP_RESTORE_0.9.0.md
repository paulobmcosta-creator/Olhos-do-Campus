# Runbook de Backup e Restore — Olhos do Campus 0.9.0

> **Rastreabilidade:** G09B-F008 | Gate 0.9-G.6 | Implementado em: 2026-09-14
> **Status:** LABORATÓRIO — Não executar contra produção sem aprovação formal.

---

## 1. Escopo

### Incluído no Backup

| Componente | Tecnologia | Conteúdo |
|---|---|---|
| Banco de dados principal | Cloud Firestore | Coleções: `occurrences`, `users`, `configurations`, `auditLog`, `teams`, `sla`, `referenceData`, `campusSpaces` |
| Fotografias de ocorrências | Cloudflare R2 (prod) / Firebase Storage (emulator/legado) | Objetos binários + metadados no Firestore |
| Configurações versionadas | Git | `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` |
| Artefatos de release | Git | `package.json`, `scripts/migrate*.ts`, `metadata.json` |

### Excluído do Backup Versionado

> [!CAUTION]
> Os itens abaixo NUNCA devem ser armazenados no repositório ou em backups públicos.

- Segredos (Secret Manager, variáveis `.env`, `.env.local`)
- Credenciais de serviço (`serviceAccountKey.json`, tokens OAuth)
- Backups reais de produção (não ficam no repositório)
- Dados pessoais de usuários além do escopo definido pela LGPD institucional

---

## 2. Responsável Operacional

| Papel | Responsabilidade |
|---|---|
| Operador de Backup | Executa backups manuais e verifica automáticos |
| Revisor de Restore | Aprova procedimento antes de qualquer restore em produção |
| Gestor de Incidente | Aciona procedimento de restore em caso de incidente |

**Pré-requisito de acesso:** Operador deve ter acesso ao projeto Firebase com permissão `datastore.databases.export` e ao bucket R2/GCS de backup.

> [!IMPORTANT]
> Toda operação de restore em produção requer aprovação de ao menos 2 pessoas: o operador e o gestor de incidente.

---

## 3. Pré-requisitos

### Ferramentas

```bash
# Verificar autenticação gcloud
gcloud auth list
gcloud config get-value project

# Verificar permissão de export do Firestore
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:$(gcloud config get-value account)"

# Verificar rclone (para R2)
rclone version
rclone listremotes

# Verificar Firebase Admin SDK
node -e "require('firebase-admin'); console.log('OK')"
```

### Variáveis de Ambiente Necessárias

```bash
# Firestore Backup
FIRESTORE_PROJECT_ID=<projeto-firebase>
FIRESTORE_DATABASE_ID=(default) # Obrigatório: (default) ou ID de named database
BACKUP_BUCKET=gs://<bucket-gcs-backup>

# Firestore Restore
TARGET_PROJECT=<projeto-staging-isolado>
TARGET_FIRESTORE_DATABASE_ID=(default) # Obrigatório: (default) ou ID de named database no destino

# R2 Backup
R2_BUCKET_NAME=<bucket-r2>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<chave>
R2_SECRET_ACCESS_KEY=<segredo>

# Controles de segurança (definidos apenas no momento de execução)
# ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP
# ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED
# ALLOW_R2_COPY=CONFIRM_R2_COPY
# PRE_RESTORE_BACKUP_CONFIRMED=YES
```

---

## 4. Frequência Proposta

| Componente | Frequência | Mecanismo |
|---|---|---|
| Firestore | Diária (00:00 BRT) | Cloud Scheduler → script `firestoreBackup.sh --apply` |
| R2 (fotos) | Semanal ou após operações destrutivas | Agendamento manual ou Cloud Scheduler |
| Configurações | A cada commit | Git (histórico do repositório) |

> [!NOTE]
> Cloud Scheduler ainda não está configurado. Configuração é passo pós-Gate G.6. Ver seção 13.

---

## 5. Retenção Proposta

| Componente | Retenção Mínima Recomendada | Decisão |
|---|---|---|
| Firestore exports (GCS) | 30 dias | `DECISION_REQUIRED` — aguarda aprovação institucional |
| R2 (fotos) | 90 dias | `DECISION_REQUIRED` — aguarda aprovação institucional |
| Configurações | Indefinida (Git) | Sem prazo de expiração no repositório |

> [!IMPORTANT]
> **DECISION_REQUIRED:** A política de retenção definitiva deve ser aprovada pela coordenação do IFES Barra de São Francisco e registrada formalmente antes da implantação em produção.

---

## 6. Criptografia e Integridade

| Componente | Criptografia em Repouso | Criptografia em Trânsito |
|---|---|---|
| Firestore exports (GCS) | AES-256 gerenciada pelo Google (padrão) | HTTPS/TLS |
| R2 (fotos) | AES-256 gerenciada pela Cloudflare (padrão) | HTTPS/TLS |
| Backup local (rehearsal) | N/A (ambiente de laboratório) | N/A |

### Verificação de Integridade

- **Firestore:** contagem de documentos por coleção antes e após restore
- **R2:** comparação de ETag/MD5 dos objetos via manifesto JSON (`r2Inventory.ts`)
- **Configurações:** hash SHA-256 dos arquivos no momento do backup

---

## 7. Como Identificar um Backup

### Nomenclatura

```
# Firestore (GCS)
gs://<BACKUP_BUCKET>/firestore-backup-YYYYMMDD-HHmmss/

# Conteúdo de um export Firestore:
firestore-backup-20260914-030000/
  all_namespaces/
    kind_occurrences/
    kind_users/
    ...
  overall_export_metadata

# R2 Manifesto (gerado por r2Inventory.ts)
manifests/r2-manifest-YYYYMMDD-HHmmss.json
```

### Identificação do Backup Mais Recente

```bash
# Listar backups Firestore ordenados por data
gsutil ls -l gs://$BACKUP_BUCKET/firestore-backup-* | sort -k2 | tail -5

# Verificar manifesto R2 mais recente
ls -lt manifests/r2-manifest-*.json | head -1
```

---

## 8. Como Verificar um Backup

### Verificação Firestore

```bash
# Verificar que o export existe e tem conteúdo
gsutil ls gs://$BACKUP_BUCKET/firestore-backup-$TIMESTAMP/
gsutil du -sh gs://$BACKUP_BUCKET/firestore-backup-$TIMESTAMP/

# Verificar metadata do export
gsutil cat gs://$BACKUP_BUCKET/firestore-backup-$TIMESTAMP/overall_export_metadata
```

### Verificação R2

```bash
# Usar r2Inventory.ts para gerar manifesto e comparar com backup anterior
npx tsx scripts/backup/r2Inventory.ts --output manifests/verify-$(date +%Y%m%d).json

# Comparar contagem de objetos
jq '.totalObjects' manifests/r2-manifest-YYYYMMDD.json
jq '.totalObjects' manifests/verify-YYYYMMDD.json
```

### Checklist de Verificação de Backup

- [ ] Export Firestore existe no GCS com tamanho > 0
- [ ] `overall_export_metadata` está presente e legível
- [ ] Manifesto R2 lista número esperado de objetos
- [ ] ETags/hashes no manifesto diferem de zero-bytes
- [ ] Timestamp do backup está dentro da janela esperada

---

## 9. Como Restaurar

> [!CAUTION]
> **NUNCA execute restore diretamente em produção sem:**
> 1. Aprovação formal de 2 pessoas
> 2. Backup do estado atual antes do restore
> 3. Janela de manutenção comunicada aos usuários
> 4. Ambiente de staging validado primeiro

### 9.1 Restore Firestore (Ambiente Isolado)

```bash
# 1. Definir variáveis
TARGET_PROJECT=olhos-do-campus-staging       # NUNCA produção sem aprovação
TARGET_FIRESTORE_DATABASE_ID=(default)      # Obrigatório: (default) ou nome do banco isolado
BACKUP_PATH=gs://$BACKUP_BUCKET/firestore-backup-YYYYMMDD-HHmmss

# 2. Dry-run (padrão)
TARGET_PROJECT=$TARGET_PROJECT \
  TARGET_FIRESTORE_DATABASE_ID=$TARGET_FIRESTORE_DATABASE_ID \
  BACKUP_PATH=$BACKUP_PATH \
  bash scripts/backup/firestoreRestore.sh

# 3. Execução real (requer confirmação explícita)
ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED \
  TARGET_PROJECT=$TARGET_PROJECT \
  TARGET_FIRESTORE_DATABASE_ID=$TARGET_FIRESTORE_DATABASE_ID \
  BACKUP_PATH=$BACKUP_PATH \
  PRE_RESTORE_BACKUP_CONFIRMED=YES \
  bash scripts/backup/firestoreRestore.sh --apply
```

### 9.2 Restore R2 (Cópia entre Buckets)

```bash
# 1. Dry-run (padrão)
npx tsx scripts/backup/r2Restore.ts \
  --source-bucket $BACKUP_BUCKET \
  --target-bucket $TARGET_BUCKET \
  --target-prefix restore-$(date +%Y%m%d)/

# 2. Execução real
ALLOW_R2_COPY=CONFIRM_R2_COPY \
  npx tsx scripts/backup/r2Restore.ts \
  --source-bucket $BACKUP_BUCKET \
  --target-bucket $TARGET_BUCKET \
  --target-prefix restore-$(date +%Y%m%d)/ \
  --apply
```

---

## 10. Ordem de Restauração

```
1. Firestore (estado mestre)
   └─ Restaurar banco de dados completo para projeto isolado

2. Validação do Firestore
   └─ Contar documentos por coleção e comparar com baseline

3. Metadados de fotos (Firestore)
   └─ Verificar que registros da coleção occurrences têm campo photoUrl válido

4. Objetos R2 (fotos binárias)
   └─ Copiar objetos do bucket de backup para bucket de destino
   └─ Usar manifesto para verificar ETag após cópia

5. Validação de Integridade Referencial
   └─ Cada photoUrl em Firestore deve ter objeto correspondente no R2
   └─ Executar script de reconciliação: scripts/reconcilePhotoStorage.ts
```

> [!WARNING]
> Restaurar R2 antes do Firestore pode resultar em objetos órfãos (fotos sem registro). Sempre seguir a ordem acima.

---

## 11. Validação Pós-Restore

### Checklist Obrigatório

- [ ] **Contagem de documentos:** total por coleção igual ao do backup
- [ ] **Integridade referencial:** 0 photoUrl apontando para objeto inexistente no R2
- [ ] **Autenticação:** login funciona para usuário de teste
- [ ] **Funcionalidade básica:** criar ocorrência de teste, verificar que aparece na listagem
- [ ] **Regras de segurança:** usuário sem permissão não consegue acessar dados de outro
- [ ] **Auditoria:** registros de auditLog intactos
- [ ] **SLA:** registros de SLA com datas coerentes

---

## 12. RPO / RTO

> [!IMPORTANT]
> **DECISION_REQUIRED:** Os valores abaixo são metas propostas e NÃO foram validados operacionalmente. Devem ser aprovados e testados formalmente antes de qualquer SLA institucional.

| Métrica | Valor | Status |
|---|---|---|
| **RPO** (Recovery Point Objective) | `DECISION_REQUIRED` | Aguarda definição institucional |
| **RTO** (Recovery Time Objective) | `DECISION_REQUIRED` | Aguarda definição institucional e rehearsal cronometrado |

---

## 13. Falhas Possíveis e Recuperação

| Cenário | Sintoma | Ação |
|---|---|---|
| Export Firestore falha por permissão | `PERMISSION_DENIED` no gcloud | Verificar IAM do service account; renovar credencial |
| GCS bucket cheio | `Quota exceeded` | Limpar backups antigos (ver seção 5) |
| R2 inacessível durante backup | Timeout ou `NoSuchBucket` | Verificar credenciais R2; verificar endpoint; tentar backup parcial |
| Export corrompido | `overall_export_metadata` ausente ou 0 bytes | NÃO usar este backup; usar backup anterior; abrir incidente |
| Restore falha por conflito | Erro `ALREADY_EXISTS` no import | Usar namespace diferente ou limpar banco de destino antes |
| Cloud Scheduler não configurado | Backup não ocorre automaticamente | Executar backup manual; configurar Scheduler (pós-Gate G.6) |

---

## 14. Rollback da Própria Restauração

Se um restore causar problemas (dados inconsistentes, versão errada restaurada):

### Procedimento de Rollback

```bash
# 1. IMEDIATAMENTE: salvar estado atual corrompido para análise
gcloud firestore export gs://$BACKUP_BUCKET/post-restore-corrupted-$(date +%Y%m%d-%H%M%S) \
  --project=$TARGET_PROJECT

# 2. Identificar backup correto (anterior ao restore problemático)
gsutil ls -l gs://$BACKUP_BUCKET/firestore-backup-* | sort -k2

# 3. Restaurar o backup correto para outro projeto de staging
TARGET_PROJECT=olhos-do-campus-staging-v2 \
  BACKUP_PATH=gs://$BACKUP_BUCKET/firestore-backup-CORRECT-TIMESTAMP \
  ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED \
  PRE_RESTORE_BACKUP_CONFIRMED=YES \
  bash scripts/backup/firestoreRestore.sh --apply

# 4. Validar staging-v2 antes de qualquer ação em produção
# 5. Documentar incidente e lições aprendidas
```

---

## Apêndice A: Scripts de Backup

- `scripts/backup/firestoreBackup.sh` — Export Firestore (dry-run padrão)
- `scripts/backup/firestoreRestore.sh` — Import Firestore para ambiente isolado
- `scripts/backup/r2Inventory.ts` — Inventário/manifesto do bucket R2
- `scripts/backup/r2Restore.ts` — Cópia R2 entre buckets
- `scripts/backup/rehearsalFirestore.ts` — Rehearsal com emulator Firestore
- `scripts/backup/rehearsalR2.ts` — Rehearsal com mock de sistema de arquivos

## Apêndice B: Referências

- [Firebase — Export and Import Data](https://firebase.google.com/docs/firestore/manage-data/export-import)
- [Cloudflare R2 — S3-compatible API](https://developers.cloudflare.com/r2/api/s3/api/)
- [gcloud firestore export](https://cloud.google.com/sdk/gcloud/reference/firestore/export)
