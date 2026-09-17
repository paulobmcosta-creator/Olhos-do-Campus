# Resend e delivery attempts — versão 0.7.3

## Semântica

A versão 0.7.3 separa explicitamente três níveis:

- **Notification / `notificationOutbox/{notificationId}`**: intenção lógica e estado agregado da notificação destinada a um destinatário;
- **DeliveryAttempt / `notificationOutbox/{notificationId}/attempts/{attemptId}`**: tentativa externa individual de envio ao Resend;
- **`providerMessageId`**: identificador do provider pertencente primariamente à tentativa que o originou.

Uma Notification pode possuir uma ou mais DeliveryAttempts. Não é criada uma nova outbox para cada retry.

## Criação e idempotência da tentativa

O claim transacional cria a nova DeliveryAttempt antes da chamada ao Resend. O `attemptNumber` deriva do `attemptCount` da outbox dentro da mesma transação, e o `attemptId` é uma derivação SHA-256 determinística de `notificationId + attemptNumber`. Cada tentativa recebe sua própria idempotency key.

Recuperação técnica de uma lease expirada ainda dentro da janela segura reutiliza a mesma tentativa e a mesma idempotency key. Um retry externo genuíno, depois de uma falha classificada como retryable, cria nova tentativa e nova chave. O limite preexistente de oito tentativas permanece.

Uma exceção de transporte/SDK sem resposta conclusiva não é convertida em nova tentativa automática: a tentativa corrente torna-se `UNCERTAIN`, sem `providerAcceptedAt`, e a outbox passa a `DELIVERY_UNCERTAIN`. Isso evita presumir aceite e evita gerar A2 quando o resultado externo de A1 é desconhecido.

## Tags técnicas

O domínio entrega ao `EmailProvider` apenas `notificationId` e `attemptId`. O `ResendEmailProvider` traduz esses identificadores para:

```text
notification_id=<notificationId>
attempt_id=<attemptId>
```

Ambos são IDs técnicos hexadecimais de 64 caracteres. Não contêm e-mail, protocolo, tracking key, descrição ou outros dados pessoais.

## Correlação de webhook

A ordem ativa é:

1. `notification_id + attempt_id` → tentativa direta;
2. `providerMessageId` → collection group `attempts`;
3. compatibilidade 0.7.2 sem `attempt_id`, usando tentativa corrente quando segura;
4. fallback legado por `providerMessageId` diretamente na outbox 0.7.2.

Se a tentativa A2 ainda não possuir `providerMessageId`, um webhook consistente de A2 pode estabelecer P2. P1 armazenado na outbox como cache da tentativa anterior não é comparado com P2 para produzir falso conflito. Há conflito apenas quando evidências sobre a **mesma tentativa** divergem ou quando IDs apontam para notificações/tentativas incompatíveis.

Webhooks `UNMATCHED_PENDING` continuam no mesmo documento de evento, agora preservando também `attemptId` quando disponível, e são reconciliados pelo ciclo de manutenção já existente.

## Estado agregado e eventos tardios

A outbox agrega apenas a tentativa corrente. Um webhook tardio de tentativa anterior pode atualizar o histórico daquela tentativa, mas não rebaixa o estado global confirmado por uma tentativa posterior. Assim, por exemplo:

```text
A1 FAILED
A2 DELIVERED
webhook tardio de A1 -> atualiza A1; outbox continua DELIVERED
```

Bounce e complaint da tentativa corrente continuam terminais conforme a política já existente; a 0.7.3 não cria novos retries automáticos para esses estados.

## Consumo lógico

O consumo lógico é contado por DeliveryAttempt com `providerAcceptedAt`. Uma tentativa conta no máximo uma unidade, independentemente de também possuir `sentAt`, webhook `email.sent` e `deliveredAt`.

```text
A1 aceita = 1
A1 aceita + A2 não aceita = 1
A1 aceita + A2 aceita = 2
```

Eventos `email.failed` não estabelecem aceite por si sós. Confirmações que semanticamente demonstram processamento/aceite, como `email.sent` e eventos posteriores de entrega, podem preencher `providerAcceptedAt` quando a persistência da resposta da API não ocorreu.

Documentos 0.7.2 sem attempts continuam legíveis. Enquanto permanecerem no schema legado, um `providerAcceptedAt` conhecido conta como uma unidade histórica mínima; se um retry 0.7.3 ocorrer, a última tentativa aceita conhecida é materializada de forma lazy antes da nova tentativa. Não há migração destrutiva nem reconstrução inventada de histórico que o modelo 0.7.2 não armazenou.

## Privacidade

DeliveryAttempts não armazenam corpo do e-mail, descrição da ocorrência, tracking key, IP, token, secret ou payload bruto de webhook. Erros são reduzidos a categoria, código e resumo sanitizado.
