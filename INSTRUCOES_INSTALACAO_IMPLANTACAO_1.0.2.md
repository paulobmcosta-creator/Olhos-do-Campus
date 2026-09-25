# Instruções de Instalação e Implantação — Versão 1.0.2

## Pré-requisitos

- Node.js `>=22.22.2 <23`;
- npm `>=10`;
- credenciais e variáveis de ambiente produtivas já existentes;
- Java/Firebase CLI somente para suítes de emuladores.

## Instalação e validação

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify:release
npm run check:scale
npm run worker:typecheck
npm run worker:test
```

## Implantação

Não há migração obrigatória de Firestore.

### Backend — Cloud Run

Gerar a imagem:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --project gen-lang-client-0120954905 \
  .
```

O build produz `olhos-do-campus-api:v1.0.2`.

Depois, executar o wrapper canônico:

```bash
ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_2 \
bash scripts/deployCloudRun.sh --apply
```

Validar:

```bash
curl -fsS https://olhos-do-campus-hnwfymhsqq-uw.a.run.app/api/health
```

O retorno deve informar `"version":"1.0.2"`.

### Frontend — Cloudflare Pages

Executar manualmente o workflow `Deploy Cloudflare Pages` sobre a branch `main` após o merge e após o backend estar na versão 1.0.2.

### Maintenance Worker

```bash
cd infra/cloudflare/maintenance-worker
npm ci
npm run typecheck
npx wrangler secret list --name olhos-do-campus-maintenance
npx wrangler deploy
```

Confirmar que `MAINTENANCE_HMAC_SECRET` já existe antes do deploy.

## Smoke test recomendado

1. criar uma ocorrência controlada e marcá-la como TEST;
2. alterar diretamente de `Recebida` para `Em atendimento`;
3. alterar diretamente para `Aguardando material` e verificar pausa de SLA;
4. alterar para `Resolvida`;
5. reabrir diretamente para `Em atendimento`;
6. confirmar histórico e contador de reabertura;
7. confirmar que `Duplicada` não aparece no seletor;
8. apensar duas ocorrências TEST e confirmar sincronização de situação.

Nenhuma implantação em produção é realizada automaticamente pelo pull request.
