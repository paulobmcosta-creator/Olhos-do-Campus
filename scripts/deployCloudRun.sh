#!/usr/bin/env bash
# =============================================================================
# G09B-F003 / G09G6R-F002 — Canonical Cloud Run Deploy Wrapper | Olhos do Campus 1.0.2
# Gate: 1.0-B
# =============================================================================
# DRY-RUN é padrão SEMPRE. Use --apply para executar.
# Requer: ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2 para --apply
#
# INVARIANTE DE SEGURANÇA (G09B-F003):
# max-instances DEVE ser fixado em 1 enquanto RATE_LIMIT_SCOPE=INSTANCE_LOCAL.
#
# USO:
#   bash scripts/deployCloudRun.sh
#   ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2 bash scripts/deployCloudRun.sh --apply
# =============================================================================

set -euo pipefail

DRY_RUN=true
if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

SERVICE_NAME="${SERVICE_NAME:-olhos-do-campus}"
REGION="${REGION:-us-west1}"
PROJECT_ID="${PROJECT_ID:-gen-lang-client-0120954905}"
IMAGE_TAG="${IMAGE_TAG:-v1.0.2}"
IMAGE_NAME="${IMAGE_NAME:-olhos-do-campus-api}"
IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}:${IMAGE_TAG}}"

# Invariante de Segurança G09B-F003: max-instances=1 obrigatório
MAX_INSTANCES=1

echo ""
echo "========================================================"
echo "  Cloud Run Canonical Deploy Wrapper | Olhos do Campus"
echo "========================================================"
echo "  Serviço:        $SERVICE_NAME"
echo "  Região:         $REGION"
echo "  Projeto:        $PROJECT_ID"
echo "  Imagem:         $IMAGE"
echo "  max-instances:  $MAX_INSTANCES (G09B-F003 Invariant)"
echo "  DRY-RUN:        $DRY_RUN"
echo "========================================================"
echo ""

CMD="gcloud run deploy \"$SERVICE_NAME\" --image=\"$IMAGE\" --region=\"$REGION\" --project=\"$PROJECT_ID\" --max-instances=\"$MAX_INSTANCES\" --allow-unauthenticated"

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY-RUN] Comando canônico de deploy:"
  echo "  $CMD"
  echo ""
  echo "[DRY-RUN] Para executar o deploy real (requer autorização prévia):"
  echo "  ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2 bash $0 --apply"
  echo ""
  echo "Dry-run concluído — nenhuma ação executada."
  exit 0
fi

if [[ "${ALLOW_CLOUD_RUN_DEPLOY:-}" != "CONFIRM_DEPLOY_1_0_2" ]]; then
  echo "ERRO DE SEGURANÇA: Deploy real não autorizado!" >&2
  echo "  Defina: ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2" >&2
  exit 1
fi

echo "Iniciando deploy no Cloud Run..."
eval "$CMD"
echo "Deploy concluído com sucesso."

