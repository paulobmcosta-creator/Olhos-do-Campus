#!/usr/bin/env bash
# =============================================================================
# G09B-F008 — Backup Firestore | Olhos do Campus 0.9.0
# Gate: 0.9-G.6
# =============================================================================
# DRY-RUN é padrão SEMPRE. Use --apply para executar.
# Requer: ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP para --apply
#
# USO:
#   bash scripts/backup/firestoreBackup.sh
#   ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP bash scripts/backup/firestoreBackup.sh --apply
#
# VARS:
#   FIRESTORE_PROJECT_ID   — ID do projeto Firebase/GCP (obrigatório)
#   FIRESTORE_DATABASE_ID  — ID do banco Firestore (obrigatório, ex: (default) ou custom)
#   BACKUP_BUCKET          — Bucket GCS: gs://meu-bucket-backup (obrigatório)
#   ALLOW_FIRESTORE_BACKUP — Deve ser "CONFIRM_BACKUP" para --apply
#   BACKUP_COLLECTIONS     — (opcional) coleções CSV; padrão: todas
# =============================================================================

set -euo pipefail

DRY_RUN=true
if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

echo ""
echo "========================================================"
echo "  G09B-F008 — Backup Firestore | Olhos do Campus"
echo "========================================================"
echo ""

if [[ "$DRY_RUN" == false ]]; then
  if [[ "${ALLOW_FIRESTORE_BACKUP:-}" != "CONFIRM_BACKUP" ]]; then
    echo "ERRO DE SEGURANÇA: Para executar backup real, voce deve:" >&2
    echo "  Definir: ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP" >&2
    echo "" >&2
    echo "Exemplo:" >&2
    echo "  ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP bash $0 --apply" >&2
    exit 1
  fi
  echo "AVISO: MODO REAL ATIVADO — Esta operacao exportara dados do Firestore"
  echo ""
fi

PROJECT="${FIRESTORE_PROJECT_ID:?ERRO: Defina FIRESTORE_PROJECT_ID}"
DATABASE="${FIRESTORE_DATABASE_ID:?ERRO: Defina FIRESTORE_DATABASE_ID (ex: (default) ou nome do banco)}"
BUCKET="${BACKUP_BUCKET:?ERRO: Defina BACKUP_BUCKET (ex: gs://meu-bucket-backup)}"

if [[ "$BUCKET" != gs://* ]]; then
  echo "ERRO: BACKUP_BUCKET deve comecar com 'gs://'" >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$BUCKET/firestore-backup-$TIMESTAMP"

COLLECTION_IDS="${BACKUP_COLLECTIONS:-}"
COLLECTION_FLAG=""
if [[ -n "$COLLECTION_IDS" ]]; then
  IFS=',' read -ra COLS <<< "$COLLECTION_IDS"
  for col in "${COLS[@]}"; do
    COLLECTION_FLAG="$COLLECTION_FLAG --collection-ids=${col// /}"
  done
fi

echo "  Projeto:    $PROJECT"
echo "  Banco:      $DATABASE"
echo "  Destino:    $DEST"
echo "  Timestamp:  $TIMESTAMP"
if [[ -n "$COLLECTION_IDS" ]]; then
  echo "  Colecoes:   $COLLECTION_IDS"
else
  echo "  Colecoes:   TODAS (backup completo)"
fi
echo "  DRY-RUN:    $DRY_RUN"
echo ""

CMD="gcloud firestore export \"$DEST\" --project=\"$PROJECT\" --database=\"$DATABASE\""
if [[ -n "$COLLECTION_FLAG" ]]; then
  CMD="$CMD $COLLECTION_FLAG"
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN] Comando que seria executado:"
  echo "  $CMD"
  echo ""
  echo "[DRY-RUN] Para executar, use:"
  echo "  FIRESTORE_PROJECT_ID=$PROJECT \\"
  echo "  FIRESTORE_DATABASE_ID=$DATABASE \\"
  echo "  BACKUP_BUCKET=$BUCKET \\"
  echo "  ALLOW_FIRESTORE_BACKUP=CONFIRM_BACKUP bash $0 --apply"
  echo ""
  echo "Dry-run concluido — nenhuma alteracao foi feita."
else
  echo "Iniciando export Firestore..."
  eval "$CMD"
  echo ""
  echo "Backup concluido: $DEST"
  echo ""
  echo "Para verificar:"
  echo "  gsutil ls $DEST"
fi
echo ""
