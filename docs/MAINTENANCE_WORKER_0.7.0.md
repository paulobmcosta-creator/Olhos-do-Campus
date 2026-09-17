# Cloudflare Maintenance Worker — versão 0.7.0

## Função

O Worker agenda duas rotinas sem Cloud Functions: processamento de notificações a cada 10 minutos e snapshot/cleanup técnico diário às 03:15 UTC. Cron Triggers usam UTC. Se o Worker estiver indisponível, o Administrador ainda pode executar teste/retry, snapshot, reconciliação e cleanup pelo painel.

## Preparação e deploy manual

```bash
cd infra/cloudflare/maintenance-worker
npm ci
npm run typecheck
npx wrangler secret put MAINTENANCE_HMAC_SECRET
npx wrangler deploy
```

Antes do deploy, substitua `BACKEND_URL` em `wrangler.jsonc` pela origem HTTPS do Cloud Run. O valor não deve conter path final. O secret precisa ser igual ao `MAINTENANCE_HMAC_SECRET` configurado no Cloud Run e deve ser longo, aleatório e exclusivo.

O Worker assina método, path e timestamp com HMAC SHA-256. O backend recusa segredo ausente, assinatura diferente e timestamp fora da janela de cinco minutos. Os endpoints internos são:

```text
POST /api/internal/maintenance/notifications
POST /api/internal/maintenance/infrastructure
```

## Teste manual

Use `wrangler dev` em um ambiente não produtivo ou dispare o Scheduled handler pelo painel Cloudflare. Confirme HTTP 2xx, itens processados e snapshot agregado. Nunca envie secret em query string nem copie a assinatura para documentação/ticket.

## Rotação do segredo

1. Gere um novo valor.
2. Atualize o secret no Cloud Run e publique a revisão.
3. Atualize imediatamente o Worker com `wrangler secret put` e publique.
4. Acione um teste manual e confira os logs.
5. Revogue o valor anterior no gerenciador de secrets.

A implementação usa um único secret ativo; portanto, faça a rotação em janela curta e aceite a pausa temporária, sem reduzir a validação.

## Logs e desativação

Consulte logs do Worker e Cloud Run pelos IDs de execução/correlação, sem corpo de e-mail ou destinatários completos. Para desativar, remova/pausa os Cron Triggers ou retire a rota do Worker; não remova a outbox. Itens permanecem persistidos e podem ser reprocessados manualmente.
