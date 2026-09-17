# Resend — semântica de retry técnico — versão 0.7.4

## Modelo preservado

A 0.7.4 preserva a separação introduzida na 0.7.3:

- **Notification** = intenção lógica em `notificationOutbox/{notificationId}`;
- **DeliveryAttempt** = tentativa externa individual em `notificationOutbox/{notificationId}/attempts/{attemptId}`;
- **Technical Retry** = repetição da **mesma** DeliveryAttempt;
- **New Delivery Attempt** = nova tentativa externa, com novo `attemptId` e nova idempotency key.

O retry técnico não cria nova outbox nem nova DeliveryAttempt.

## Invariantes

```text
mesma DeliveryAttempt
→ mesmo attemptId
→ mesmo attemptNumber
→ mesma idempotency key
→ mesmo registro de attempt
```

```text
nova DeliveryAttempt
→ novo attemptId
→ attemptNumber + 1
→ nova idempotency key
```

`attemptCount` representa DeliveryAttempts independentes e não quantidade de chamadas HTTP. O campo `technicalRetryCount` pertence à tentativa e registra somente repetições técnicas daquela tentativa.

## Classificação para retry

O `EmailProviderError` pode transportar `retryMode` e `retrySafety`, sem expor ao domínio a sintaxe proprietária do Resend.

### SAME_ATTEMPT + IDEMPOTENCY_WINDOW

Usado quando o resultado é transitório/ambíguo e a repetição deve permanecer sob a proteção da mesma idempotency key, incluindo:

- `concurrent_idempotent_requests`;
- respostas estruturadas 5xx;
- 408/status 0 estruturado pelo provider;
- ausência de objeto de resposta do provider após uma chamada tratada pelo SDK.

A repetição ocorre somente enquanto a janela segura da idempotency key permanecer válida. Fora dela, a tentativa passa a `UNCERTAIN` e a outbox a `DELIVERY_UNCERTAIN`; A2 não é criada automaticamente.

### SAME_ATTEMPT + PROVIDER_REJECTED

Usado para rejeições explícitas de quota/rate limit. O provider informou que aquela chamada não foi aceita como nova entrega; por isso o sistema mantém a mesma DeliveryAttempt e aplica diferimento/backoff sem inflar `attemptCount`.

### NEW_ATTEMPT

Só é usado quando a tentativa anterior teve resultado suficientemente conhecido para permitir outro envio externo, por exemplo uma falha confirmada e classificada como retryable pela política existente. A tentativa anterior é encerrada como `FAILED` e o claim posterior cria A2/K2.

### Resultado de transporte sem resposta conclusiva

Exceção de rede/SDK que não chega como `EmailProviderError` continua conservadora: A1 passa diretamente a `UNCERTAIN` e a outbox a `DELIVERY_UNCERTAIN`. Não se presume que o provider não recebeu a chamada e não se cria A2 automaticamente.

## `concurrent_idempotent_requests`

O fluxo obrigatório é:

```text
A1 / K1
↓
Resend: concurrent_idempotent_requests
↓
A1 = RETRY_PENDING
technicalRetryCount += 1
nextAttemptAt = backoff
↓
claim posterior
↓
retoma A1 / K1
```

Nenhum A2/K2 nasce desse erro.

## Backoff e limite

O retry técnico usa backoff exponencial persistido, iniciado em 30 segundos e limitado a 15 minutos por intervalo. A tentativa admite no máximo quatro retries técnicos automáticos.

Se um quinto retry técnico seria necessário, ou se um retry dependente da janela de idempotência cair fora da janela segura, a tentativa torna-se `UNCERTAIN`. Isso bloqueia nova entrega automática potencialmente duplicada.

## Webhooks durante backoff

As tags continuam:

```text
notification_id=<notificationId>
attempt_id=<attemptId>
```

Se A1 estiver em `RETRY_PENDING` e um webhook válido de A1 chegar, o estado da própria tentativa é atualizado normalmente. Estados terminais/confirmados removem `retryMode`, `retrySafety` e `nextAttemptAt`; como consequência, o claim posterior não retoma A1.

A máquina de estados agregada permanece monotônica e webhooks tardios de attempts anteriores não rebaixam uma entrega posterior já confirmada.

## ProviderMessageId

O `providerMessageId` continua pertencendo primariamente à DeliveryAttempt. Se uma repetição técnica de A1 retornar P1 e A1 ainda não o tiver, P1 é persistido. Se a mesma tentativa já possuir outro ID incompatível, a inconsistência não é sobrescrita silenciosamente.

## Consumo lógico

O consumo continua baseado em DeliveryAttempts com `providerAcceptedAt`:

```text
A1/K1 chamada uma vez e aceita = 1
A1/K1 chamada tecnicamente duas ou mais vezes, com um único aceite = 1
A1 aceita + A2 aceita = 2
```

`technicalRetryCount` e quantidade de chamadas HTTP não são unidades de consumo.

## Compatibilidade e privacidade

Documentos 0.7.2/0.7.3 continuam legíveis; campos novos de retry são opcionais e ausentes em documentos históricos. Não há migração destrutiva.

Attempts continuam sem corpo do e-mail, descrição da ocorrência, tracking key, IP, token, secret ou payload bruto de webhook. Logs e erros mantêm somente códigos e resumos sanitizados.
