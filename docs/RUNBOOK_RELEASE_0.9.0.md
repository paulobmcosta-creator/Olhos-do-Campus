# Runbook de Release — Olhos do Campus 0.9.0

## Visão Geral

Este runbook descreve o processo canônico de build e release da versão 0.9.0.
Nenhuma ação de deploy real é executada por este documento — ele serve como
referência operacional e checklist de verificação.

---

## Cadeia de Versões

```
package.json#version  →  _IMAGE_TAG  →  Docker image tag  →  Cloud Run revision
```

| Artefato              | Valor 0.9.0            | Responsável         |
|-----------------------|------------------------|---------------------|
| `package.json#version`| `0.9.0`                | Engenharia          |
| `_IMAGE_TAG`          | `v0.9.0`               | `cloudbuild.yaml`   |
| Artifact Registry     | `olhos-do-campus-api:v0.9.0` | Cloud Build   |
| Cloud Run revision    | `olhos-do-campus-api-XXXXXX` | Cloud Run     |

> **Invariante**: `_IMAGE_TAG` em `cloudbuild.yaml` deve corresponder a `v{package.json#version}`.
> Discrepâncias geram revisão com imagem incorreta.

---

## Pré-requisitos de Build

Antes de iniciar o build de release:

- [ ] `npm run validate` passou sem erros (typecheck + lint + test + build)
- [ ] `npm run check:scale` retornou `STATUS: PASS`
- [ ] `_IMAGE_TAG` em `cloudbuild.yaml` atualizado para `v0.9.0`
- [ ] `package.json#version` em `0.9.0`
- [ ] Não há branch `main` com commits não revisados

---

## Passo a Passo de Release (Ciclo 0.9.0)

### Etapa 1 — Validação local

```bash
# Valida typecheck, lint, testes e build completo
npm run validate

# Verifica invariante de scale-out
npm run check:scale
```

Saída esperada de `check:scale`:
```
MAX_SCALE_1_SECURITY_INVARIANT=YES
SCALE_OUT_ALLOWED=NO
SCALE_OUT_PREREQUISITE=DISTRIBUTED_OR_EDGE_RATE_LIMIT
STATUS: PASS (max-instances=1 — topologia segura para INSTANCE_LOCAL)
```

### Etapa 2 — Verificação de identidade do release

```bash
npm run verify:release
```

Este script (quando implementado) deve verificar:
- Consistência entre `package.json#version` e `_IMAGE_TAG` em `cloudbuild.yaml`
- Ausência de TODO/FIXME bloqueantes em arquivos críticos
- Versão correta do Node.js

### Etapa 3 — Build da imagem Docker

> **NOTA**: O build real é executado pelo Cloud Build. O comando abaixo é referência.

```bash
# Simulação local (não requerida para release normal)
docker build \
  --tag us-west1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/olhos-do-campus-api:v0.9.0 \
  .
```

### Etapa 4 — Cloud Build (gatilho automático)

O Cloud Build é acionado automaticamente ao fazer push na branch de release.
O build executa:
1. Validação da região `_REGION`
2. Build da imagem Docker
3. Push para Artifact Registry `us-west1`

### Etapa 5 — Deploy no Cloud Run

> **PROIBIÇÃO**: Não execute deploy em produção sem aprovação do Gate J.

O deploy canônico de Cloud Run cria uma nova revision com a imagem `v0.9.0`.
O processo DEVE ser executado exclusivamente através do wrapper canônico:
```bash
# Simulação / verificação de comando (dry-run):
bash scripts/deployCloudRun.sh

# Deploy real (requer autorização prévia documentada):
ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_0_9 bash scripts/deployCloudRun.sh --apply
```

Parâmetros obrigatórios do Cloud Run (fixados pelo wrapper `scripts/deployCloudRun.sh`):
- `max-instances`: 1 (invariante de segurança G09B-F003 / G09G6R-F002)
- `--region`: `us-west1`
- Variáveis de ambiente: todas as listadas em `.env.example` configuradas como secrets

### Etapa 6 — Verificação pós-deploy

```bash
# Verificar revision ativa
gcloud run revisions list \
  --service olhos-do-campus-api \
  --region us-west1 \
  --project ${PROJECT_ID}

# Verificar health endpoint
curl -s https://<endpoint>/health
```

---

## Verificação de Identidade

```bash
npm run verify:release
```

Script deve verificar:
1. `package.json#version === "0.9.0"`
2. `cloudbuild.yaml` contém `_IMAGE_TAG: v0.9.0`
3. `npm run check:scale` retorna código 0
4. Nenhum arquivo crítico contém `TODO_GATE_BLOCK`

---

## Referências

- [`cloudbuild.yaml`](../cloudbuild.yaml) — configuração de build
- [`scripts/deployCloudRun.sh`](../scripts/deployCloudRun.sh) — wrapper canônico de deploy (max-instances=1)
- [`docs/SCALE_OUT_POLICY_0.9.0.md`](./SCALE_OUT_POLICY_0.9.0.md) — política de scale
- [`docs/RUNBOOK_ROLLBACK_0.9.0.md`](./RUNBOOK_ROLLBACK_0.9.0.md) — procedimento de rollback
- [`scripts/checkScaleConfig.mjs`](../scripts/checkScaleConfig.mjs) — guard G09B-F003 / G09G6R-F002
