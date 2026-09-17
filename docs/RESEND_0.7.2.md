# Resend, correlação e reconciliação de webhooks — 0.7.2

## Escopo

A 0.7.2 preserva a transactional outbox, a idempotency key, as leases, os retries, `DELIVERY_UNCERTAIN`, a assinatura de webhook e a máquina de estados monotônica da 0.7.1. A alteração fecha a janela residual na qual o webhook poderia chegar antes da persistência local de `providerMessageId`.

## Identificador técnico

Cada chamada ao provider recebe o `notificationId` determinístico da outbox. Somente `ResendEmailProvider` o converte em:

```text
notification_id=<notificationOutboxId>
```

O ID aceito é exclusivamente SHA-256 hexadecimal em minúsculas com 64 caracteres, exatamente o formato já produzido pela outbox. A tag não contém destinatário, protocolo, tracking key, descrição, foto ou conteúdo da ocorrência.

## Correlação

Depois da validação da assinatura e do schema, a ordem é:

1. `notification_id` válido → leitura direta de `notificationOutbox/{id}`;
2. fallback por `providerMessageId`.

A correlação antiga permanece para mensagens anteriores ou sem tag. Se o ID lógico e o `providerMessageId` apontarem para documentos incompatíveis, o webhook não altera nenhuma entrega: o registro operacional recebe `INCONSISTENT` e `WEBHOOK_CORRELATION_CONFLICT`.

Uma tag `notification_id` presente mas fora do formato esperado é rejeitada como webhook inválido. Outras tags são ignoradas pelo domínio.

## Webhooks não correlacionados

Um webhook válido sem outbox correlacionável é salvo em `notificationWebhookEvents/{eventId}` como `UNMATCHED_PENDING`. São persistidos apenas:

- tipo e ID do evento;
- `providerMessageId`;
- `notificationId`, se presente;
- timestamp do provedor;
- razão sanitizada de `email.failed`, quando existente;
- primeira observação, última tentativa, tentativas e próxima tentativa;
- status, alvo correlacionado e código operacional seguro, quando aplicável;
- prazo técnico de retenção.

Não são persistidos payload bruto, HTML, corpo do e-mail, headers completos, IP, API key, webhook secret, descrição da ocorrência ou destinatário.

A mesma identidade do evento é mantida durante todo o ciclo:

```text
UNMATCHED_PENDING -> PROCESSED
UNMATCHED_PENDING -> UNMATCHED_EXPIRED
```

Não é criado documento duplicado para contornar a deduplicação.

## Reconciliação

O endpoint interno de manutenção de notificações executa:

1. processamento normal da outbox;
2. reconciliação de `UNMATCHED_PENDING`.

O Maintenance Worker já existente continua apenas chamando o Cloud Run com HMAC e não acessa Firestore diretamente.

Controles:

- máximo de 50 eventos por ciclo;
- backoff exponencial iniciado em 1 minuto e limitado a 6 horas;
- máximo de 12 tentativas;
- janela máxima de 72 horas para permanecer unmatched;
- estados terminais de evento retidos por 90 dias;
- limpeza terminal limitada a 50 documentos por ciclo.

## Concorrência

`markSent`, `markDeliveryUncertain` e `markFailure` continuam transacionais e somente escrevem quando a outbox ainda está `PROCESSING` e a lease pertence ao worker. Assim:

```text
PROCESSING
+ webhook DELIVERED por notification_id
-> DELIVERED

DELIVERED
+ markSent tardio
-> DELIVERED

DELIVERED
+ markDeliveryUncertain tardio
-> DELIVERED
```

O webhook também resolve `DELIVERY_UNCERTAIN` quando possui confirmação externa válida, respeitando a precedência existente para delivered, bounce, complaint e `email.failed`.

## Consumo lógico

O painel passa a distinguir:

- aceites pelo provedor (`providerAcceptedAt`);
- envios persistidos (`sentAt`);
- entregas confirmadas (`DELIVERED`).

Uma outbox com `providerAcceptedAt` conta uma vez para o consumo lógico, ainda que também possua `sentAt`. `DELIVERY_UNCERTAIN` com aceite conhecido conta; mensagem sem aceite não conta.

A métrica é operacional e não substitui cota ou faturamento do Resend.
