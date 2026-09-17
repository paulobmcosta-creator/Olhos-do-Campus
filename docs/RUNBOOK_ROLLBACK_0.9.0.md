# Runbook de Rollback — Olhos do Campus 0.9.0

## Visão Geral

Este runbook descreve o procedimento de rollback do Cloud Run para a revision
anterior, sem execução de novo deploy. O rollback é uma operação de roteamento
de tráfego — a imagem Docker anterior já está no Artifact Registry.

> **PROIBIÇÃO**: Não execute deploy real sem aprovação do Gate J.
> Este documento é referência operacional. O rollback via `gcloud` pode ser
> executado em emergência pelo SRE responsável.

---

## Quando Usar Este Runbook

- Instabilidade observada após deploy de nova revision
- Taxa de erro elevada (> 5% em 5 minutos no endpoint principal)
- Timeout generalizado sem causa identificada
- Resultado de health check com falha persistente

---

## Etapa 1 — Identificar a Revision Anterior

```bash
# Listar revisões do serviço em ordem decrescente
gcloud run revisions list \
  --service olhos-do-campus-api \
  --region us-west1 \
  --project ${PROJECT_ID} \
  --sort-by "~DEPLOYED" \
  --format "table(name, status.conditions[0].status, spec.containers[0].image)"
```

Saída esperada:
```
NAME                              SERVING  IMAGE
olhos-do-campus-api-00002-xyz     ACTIVE   us-west1-docker.pkg.dev/.../v0.9.0
olhos-do-campus-api-00001-abc     INACTIVE us-west1-docker.pkg.dev/.../v0.8.0
```

Anote o nome da revision anterior (`olhos-do-campus-api-00001-abc` no exemplo).

---

## Etapa 2 — Executar Rollback de Tráfego

```bash
# Redirecionar 100% do tráfego para a revision anterior
# SUBSTITUA <REVISION_ANTERIOR> pelo nome real identificado na Etapa 1
gcloud run services update-traffic olhos-do-campus-api \
  --region us-west1 \
  --project ${PROJECT_ID} \
  --to-revisions <REVISION_ANTERIOR>=100
```

> **Nota**: Este comando não faz deploy de nova imagem. Apenas redireciona
> o tráfego para uma revision já existente.

---

## Etapa 3 — Confirmar Rollback

```bash
# Verificar distribuição de tráfego
gcloud run services describe olhos-do-campus-api \
  --region us-west1 \
  --project ${PROJECT_ID} \
  --format "yaml(status.traffic)"
```

Saída esperada após rollback:
```yaml
traffic:
- percent: 100
  revisionName: olhos-do-campus-api-00001-abc
  url: https://olhos-do-campus-api-xxx-uw.a.run.app
```

---

## Etapa 4 — Validação Pós-Rollback

Execute os checks a seguir **imediatamente** após o rollback:

### 4.1 Health Check

```bash
curl -s -o /dev/null -w "%{http_code}" https://<endpoint>/health
# Esperado: 200
```

### 4.2 Endpoint de verificação de identidade

```bash
curl -s https://<endpoint>/version
# Esperado: versão anterior (ex: 0.8.0)
```

### 4.3 Monitoramento de erros (primeiros 15 minutos)

Acesse o Cloud Logging e filtre:
```
resource.type="cloud_run_revision"
resource.labels.service_name="olhos-do-campus-api"
severity>=ERROR
```

Taxa de erros deve retornar ao baseline pré-incidente em até 5 minutos.

### 4.4 Verificação de coleções Firestore

Se a revision com problema executou migrações, verifique integridade:

```bash
# Com emulador — verificação de contagem básica
tsx scripts/migrate080.ts  # dry-run — apenas leitura
```

---

## Etapa 5 — Comunicação e Registro

Após o rollback bem-sucedido:

1. Registrar o incidente no canal de operações com:
   - Revision revertida: `<REVISION_ATUAL>`
   - Revision alvo: `<REVISION_ANTERIOR>`
   - Horário do rollback (UTC-3)
   - Causa identificada (se já conhecida)

2. Abrir issue de post-mortem com:
   - Linha do tempo do incidente
   - Causa raiz
   - Ação corretiva antes de novo deploy

---

## Referência Rápida (Cheat Sheet)

```bash
# 1. Ver revisões
gcloud run revisions list --service olhos-do-campus-api --region us-west1 --project $PROJECT_ID

# 2. Rollback para revision específica
gcloud run services update-traffic olhos-do-campus-api \
  --region us-west1 --project $PROJECT_ID \
  --to-revisions <REVISION_ANTERIOR>=100

# 3. Confirmar tráfego
gcloud run services describe olhos-do-campus-api \
  --region us-west1 --project $PROJECT_ID \
  --format "yaml(status.traffic)"

# 4. Health check
curl -s https://<endpoint>/health
```

---

## Considerações de Segurança

- `max-instances=1` durante o rollback mantém a invariante de segurança G09B-F003
- Rollback não requer novo `BACKUP_CONFIRMED` pois não executa migração de dados
- Se a revision anterior também apresentar problemas, acionar suporte do Cloud Run

## Referências

- [`docs/RUNBOOK_RELEASE_0.9.0.md`](./RUNBOOK_RELEASE_0.9.0.md) — release canônico
- [`docs/SCALE_OUT_POLICY_0.9.0.md`](./SCALE_OUT_POLICY_0.9.0.md) — invariante de scale
- [`docs/ADR_REGION_0.9.0.md`](./ADR_REGION_0.9.0.md) — decisão de região
