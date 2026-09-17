#!/usr/bin/env bash
# =============================================================================
# G09B-F008 — Restore Firestore PARA DESTINO ISOLADO | Olhos do Campus 0.9.0
# Gate: 0.9-G.6
# =============================================================================
# NUNCA restaura producao por padrao
# DRY-RUN e padrao SEMPRE. Use --apply para executar.
# Requer ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED
# Requer TARGET_PROJECT diferente do projeto de producao
# Requer PRE_RESTORE_BACKUP_CONFIRMED=YES
#
# USO:
#   BACKUP_PATH=gs://bucket/firestore-backup-YYYYMMDD-HHmmss \
#   TARGET_PROJECT=meu-projeto-staging \
#   TARGET_FIRESTORE_DATABASE_ID=(default) \
#   bash scripts/backup/firestoreRestore.sh
#
#   BACKUP_PATH=gs://bucket/firestore-backup-YYYYMMDD-HHmmss \
#   TARGET_PROJECT=meu-projeto-staging \
#   TARGET_FIRESTORE_DATABASE_ID=(default) \
#   PRODUCTION_PROJECT=meu-projeto-prod \
#   ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED \
#   PRE_RESTORE_BACKUP_CONFIRMED=YES \
#   bash scripts/backup/firestoreRestore.sh --apply
# =============================================================================

set -euo pipefail

DRY_RUN=true
if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

echo ""
echo "========================================================"
echo "  G09B-F008 — Restore Firestore | Olhos do Campus"
echo "========================================================"
echo ""

BACKUP_PATH="${BACKUP_PATH:?ERRO: Defina BACKUP_PATH (ex: gs://bucket/firestore-backup-YYYYMMDD)}"
TARGET_PROJECT="${TARGET_PROJECT:?ERRO: Defina TARGET_PROJECT (projeto ISOLADO — NUNCA producao)}"
TARGET_DATABASE="${TARGET_FIRESTORE_DATABASE_ID:?ERRO: Defina TARGET_FIRESTORE_DATABASE_ID (ex: (default) ou nome do banco)}"

if [[ "$BACKUP_PATH" != gs://* ]]; then
  echo "ERRO: BACKUP_PATH deve comecar com 'gs://'" >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]]; then

  # Verificacao 1: Token de confirmacao
  if [[ "${ALLOW_RESTORE:-}" != "CONFIRM_RESTORE_ISOLATED" ]]; then
    echo "ERRO DE SEGURANCA [1/3]: Token de confirmacao ausente ou incorreto." >&2
    echo "  Defina: ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED" >&2
    exit 1
  fi

  # Verificacao 2: Projeto destino nao pode ser o de producao
  PROD="${PRODUCTION_PROJECT:-olhos-do-campus}"
  if [[ "$TARGET_PROJECT" == "$PROD" ]]; then
    echo "ERRO DE SEGURANCA [2/3]: TARGET_PROJECT igual ao projeto de producao!" >&2
    echo "  TARGET_PROJECT: $TARGET_PROJECT" >&2
    echo "  PRODUCTION_PROJECT: $PROD" >&2
    echo "  RECUSADO — restore em producao requer processo formal separado." >&2
    exit 1
  fi

  # Verificacao 3: Confirmar backup pre-restore
  if [[ "${PRE_RESTORE_BACKUP_CONFIRMED:-}" != "YES" ]]; then
    echo "ERRO DE SEGURANCA [3/3]: Confirmacao de backup pre-restore ausente." >&2
    echo "  Antes de restaurar, faca backup do estado atual:" >&2
    echo "  ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP bash scripts/backup/firestoreBackup.sh --apply" >&2
    echo "  Entao defina: PRE_RESTORE_BACKUP_CONFIRMED=YES" >&2
    exit 1
  fi

  echo "AVISO: MODO REAL ATIVADO — Importando dados para o Firestore"
  echo "  Destino: $TARGET_PROJECT"
  echo "  Banco:   $TARGET_DATABASE"
  echo ""
fi

echo "  Backup:     $BACKUP_PATH"
echo "  Destino:    $TARGET_PROJECT"
echo "  Banco:      $TARGET_DATABASE"
echo "  DRY-RUN:    $DRY_RUN"
echo ""

CMD="gcloud firestore import \"$BACKUP_PATH\" --project=\"$TARGET_PROJECT\" --database=\"$TARGET_DATABASE\""

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN] Verificacoes de seguranca que serao aplicadas:"
  echo "  * ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED (requerido)"
  echo "  * TARGET_PROJECT != PRODUCTION_PROJECT (requerido)"
  echo "  * PRE_RESTORE_BACKUP_CONFIRMED=YES (requerido)"
  echo "  * TARGET_FIRESTORE_DATABASE_ID definido (requerido)"
  echo ""
  echo "[DRY-RUN] Comando que seria executado:"
  echo "  $CMD"
  echo ""
  echo "[DRY-RUN] Para executar:"
  echo "  ALLOW_RESTORE=CONFIRM_RESTORE_ISOLATED \\"
  echo "  TARGET_PROJECT=$TARGET_PROJECT \\"
  echo "  TARGET_FIRESTORE_DATABASE_ID=$TARGET_DATABASE \\"
  echo "  BACKUP_PATH=$BACKUP_PATH \\"
  echo "  PRE_RESTORE_BACKUP_CONFIRMED=YES \\"
  echo "  bash $0 --apply"
  echo ""
  echo "Dry-run concluido — nenhuma alteracao foi feita."
else
  echo "Iniciando import Firestore..."
  eval "$CMD"
  echo ""
  echo "Import iniciado!"
  echo ""
  echo "Acompanhar progresso:"
  echo "  gcloud firestore operations list --project=$TARGET_PROJECT"
  echo ""
  echo "AVISO: Execute o checklist de validacao pos-restore (RUNBOOK secao 11)"
fi
echo ""
