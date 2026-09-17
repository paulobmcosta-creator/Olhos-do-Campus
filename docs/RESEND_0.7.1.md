# Resend, outbox e semântica de entrega — 0.7.1

## Garantia que o sistema realmente oferece

A 0.7.1 não descreve e não implementa garantia global de exactly-once. A semântica operacional é:

```text
intenção de notificação persistida deterministicamente
+ entrega externa at-least-once
+ deduplicação local
+ idempotência adicional do provedor dentro da janela oferecida pelo Resend
```

A chave de idempotência do Resend possui janela temporal limitada. Por isso, a mesma chave não é tratada como proteção eterna contra duplicidade.

## DELIVERY_UNCERTAIN

Quando o Resend aceita a solicitação, mas o backend não consegue persistir `markSent()` de forma conclusiva, a outbox tenta registrar `DELIVERY_UNCERTAIN` com o ID recebido do provedor.

Também ocorre proteção equivalente quando uma lease `PROCESSING` expira depois da janela segura de idempotência.

`DELIVERY_UNCERTAIN`:

- não entra no retry automático;
- não entra no retry administrativo genérico;
- pode ser reconciliado por webhook do provedor;
- exige análise/reconciliação antes de qualquer reenvio deliberado.

Se o processo morrer em um ponto no qual nem o aceite externo nem o estado local puderem ser conhecidos, essa incerteza distribuída não pode ser eliminada por software local; a 0.7.1 documenta essa limitação em vez de alegar garantia impossível.

## `email.failed`

`email.failed` não é mais sinônimo de `SUPPRESSED`. A classificação usa o motivo informado pelo provedor quando disponível:

- quota/rate limit → `DEFERRED`, categoria `QUOTA`;
- indisponibilidade transitória → `RETRY_PENDING`, categoria `TRANSIENT`;
- configuração, autenticação, domínio ou remetente → `FAILED_CONFIGURATION`, categoria `CONFIGURATION`;
- destinatário inválido → `FAILED`, categoria `INVALID_RECIPIENT`;
- supressão efetiva → `SUPPRESSED`, categoria `SUPPRESSION`;
- razão desconhecida/permanente → `FAILED`, categoria `UNKNOWN`.

Bounce e complaint possuem eventos próprios e terminam em `BOUNCED` e `COMPLAINED`.

`FAILED_CONFIGURATION` é terminal para o processamento automático. Depois de corrigida a configuração externa, um Administrador pode recolocá-la na fila pela ação explícita de reprocessamento. Essa ação não inclui `DELIVERY_UNCERTAIN`, justamente para não transformar incerteza de entrega em duplicidade automática.

O painel administrativo mostra contadores de entrega incerta, falha de configuração e a categoria segura da última falha. Payload bruto do webhook não é persistido.

## Eventos fora de ordem

A transição usa `created_at` do provedor quando presente e `event ID` para deduplicação. Eventos anteriores ao último timestamp processado são ignorados. Há precedência explícita para estados adversos terminais; por exemplo:

```text
DELIVERED + delivery_delayed -> DELIVERED
DELIVERED + sent             -> DELIVERED
COMPLAINED + delivered       -> COMPLAINED
BOUNCED + sent               -> BOUNCED
BOUNCED + complained posterior -> COMPLAINED
```

Assim, a ordem de chegada HTTP não pode rebaixar um estado mais definitivo.
