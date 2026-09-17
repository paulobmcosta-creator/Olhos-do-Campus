# Infraestrutura e capacidade — observabilidade residual 0.7.2

## Resend

As referências diária e mensal passam a usar `providerAcceptedAt`, pois representam consumo lógico aceito pelo provedor. `sentAt` permanece disponível como indicador distinto e não é somado novamente quando os dois timestamps existem.

O painel diferencia aceites, enviados, entregues, retries, entregas incertas, bounced, complained, falhas e webhooks ainda não correlacionados.

Quando `UNMATCHED_PENDING > 0`, o painel mostra atenção operacional. Se o evento pendente mais antigo ultrapassar uma hora, a sinalização é elevada para warning. IDs internos não são exibidos no dashboard principal.

## Artifact Registry

A política de cleanup da 0.7.1 não foi alterada.

O valor de bytes coletado pelo snapshot passa a ser apresentado como:

> Soma lógica aproximada das imagens observadas

Esse valor não corresponde necessariamente ao armazenamento faturado pelo Google Cloud, pois camadas podem ser compartilhadas entre imagens. Não foi adicionada Billing API e nenhuma nova permissão foi concedida.

## R2

Nenhuma regra de migração, fallback, verify, cleanup ou inventário R2 foi alterada na 0.7.2.
