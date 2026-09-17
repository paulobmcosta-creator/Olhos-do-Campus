# Instalação e implantação — versão 0.7.1

## Baseline

- Node.js `>=22.22.2 <23`;
- npm `>=10`;
- Java/JRE para Firebase Emulator Suite;
- secrets exclusivamente fora do repositório.

O Dockerfile usa Node `22.22.2-bookworm-slim`. O Worker declara o mesmo intervalo de Node para tooling local/CI.

## Região

O ambiente histórico ativo do projeto utiliza `us-west1`. O `cloudbuild.yaml` 0.7.1 usa `_REGION: us-west1` e possui validação explícita antes de construir a imagem. Não altere `_REGION` para outra região sem decisão operacional deliberada.

A imagem é publicada em:

```text
${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPOSITORY}/${_IMAGE}:${SHORT_SHA}
```

O arquivo de Cloud Build constrói e envia a imagem; não executa deploy real, migração de dados, cleanup do Registry ou publicação de Pages/Worker.

## Ordem pré-implantação

1. `npm ci` em Node compatível;
2. typecheck, lint, testes, Worker, build e audit;
3. homologar `storage:migrate:r2 --verify` contra recursos descartáveis/ambiente autorizado;
4. revisar dry-run da policy do Artifact Registry;
5. configurar Resend, webhook e domínios sem habilitar notificações reais prematuramente;
6. publicar Cloud Run em `us-west1` somente após revisão dos secrets/origens;
7. publicar Pages com a URL final da API;
8. configurar Worker/HMAC;
9. observar outbox, R2, cleanup e capacidade;
10. somente depois decidir desativação do fallback e exclusão da origem legada.

## Rollback

- mantenha as 10 versões recentes e tags explícitas `release-`/`rollback-` necessárias;
- durante a transição R2, não exclua a origem até verificação integral;
- em problema de e-mail, desabilite notificações e preserve a outbox para análise;
- `DELIVERY_UNCERTAIN` não deve ser reenviado automaticamente;
- pause o cron do Worker se houver comportamento inesperado; ações manuais administrativas permanecem disponíveis.
