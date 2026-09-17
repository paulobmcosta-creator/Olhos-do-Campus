# Checklist de homologação manual — versão 0.7.4

Aplique também todos os itens ainda pertinentes de `HOMOLOGACAO_MANUAL_0.7.3.md` e versões anteriores.

## Delivery attempts e tags

- [ ] Primeiro envio possui `notification_id` e `attempt_id`
- [ ] `notification_id` e `attempt_id` contêm somente IDs técnicos, sem PII
- [ ] A tentativa existe no Firestore antes da chamada externa ao Resend
- [ ] Retry possui o mesmo `notification_id` e novo `attempt_id`
- [ ] Retry externo genuíno possui nova idempotency key
- [ ] Recuperação técnica da mesma tentativa reutiliza `attempt_id` e idempotency key
- [ ] Dois workers concorrentes não criam duas tentativas para o mesmo claim

## ProviderMessageId e webhooks

- [ ] Primeiro envio pode registrar P1 em A1
- [ ] Segundo envio pode registrar P2 em A2 sem sobrescrever o histórico P1 de A1
- [ ] Webhook rápido de A2 antes de `markSent(P2)` correlaciona por `notification_id + attempt_id`
- [ ] P1 da tentativa anterior não gera conflito falso com P2 da tentativa atual
- [ ] `providerMessageId` divergente dentro da mesma tentativa é tratado como inconsistência
- [ ] Fallback por `providerMessageId` encontra a tentativa correta
- [ ] Mensagem 0.7.2 sem `attempt_id` continua correlacionável
- [ ] `providerMessageId` legado diretamente na outbox continua funcionando
- [ ] Webhook tardio de A1 atualiza A1 sem rebaixar A2/estado global já entregue
- [ ] `DELIVERY_UNCERTAIN` da tentativa corrente é resolvido por webhook válido
- [ ] Exceção de transporte sem resultado conclusivo não cria retry automático nem conta aceite sem confirmação

## Consumo e painel

- [ ] A1 aceita conta uma unidade
- [ ] A1 aceita + A2 não aceita continua uma unidade
- [ ] A1 aceita + A2 aceita conta duas unidades
- [ ] `deliveredAt` não incrementa consumo novamente
- [ ] Replay de webhook não incrementa consumo novamente
- [ ] `email.failed` pré-aceite não conta como aceite
- [ ] Tentativa `UNCERTAIN` com aceite confirmado conta; resultado incerto sem aceite confirmado não conta
- [ ] Painel distingue tentativas iniciadas, aceitas, entregues, falhas, bounces, complaints, incertas e retries
- [ ] Aceites legados 0.7.2 continuam visíveis na referência de consumo

## Compatibilidade e segurança

- [ ] Documento 0.7.2 sem subcoleção `attempts` permanece legível
- [ ] Retry de documento legado materializa apenas a última tentativa histórica conhecida quando houver evidência suficiente
- [ ] Subcoleção `attempts` permanece inacessível ao navegador pelas regras deny-all
- [ ] Nenhum corpo de e-mail, tracking key, IP, token, secret ou payload bruto é persistido em attempts/webhooks


## Retry técnico Resend — 0.7.4

- [ ] `concurrent_idempotent_requests` reutiliza A1/K1
- [ ] `concurrent_idempotent_requests` não cria A2
- [ ] Retry técnico preserva `attemptNumber` e `attemptCount`
- [ ] Retry técnico preserva a idempotency key
- [ ] `technicalRetryCount` cresce sem alterar o número da DeliveryAttempt
- [ ] Backoff impede loop automático imediato da mesma tentativa
- [ ] 5xx/408 ambíguo estruturado não cria nova tentativa prematuramente
- [ ] Timeout de transporte sem resposta conclusiva fica `DELIVERY_UNCERTAIN` e não cria A2
- [ ] Rate limit/quota diferido mantém a mesma tentativa sem inflar `attemptCount`
- [ ] Falha confirmada e retryable encerra A1 e autoriza nova A2/K2
- [ ] Webhook válido durante backoff resolve A1 e impede retry posterior
- [ ] ProviderMessageId incompatível dentro da mesma tentativa não é sobrescrito silenciosamente
- [ ] Quatro retries técnicos preservam A1; ultrapassar o limite torna A1 `UNCERTAIN` sem criar A2
- [ ] Consumo não duplica por chamadas técnicas repetidas da mesma DeliveryAttempt
- [ ] A2 só adiciona unidade de consumo quando for realmente criada e aceita
- [ ] Dois workers concorrentes não retomam simultaneamente a mesma A1
