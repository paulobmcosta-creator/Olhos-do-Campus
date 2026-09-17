# Checklist de homologação manual — versão 0.7.2

Aplique também os itens ainda pertinentes de `HOMOLOGACAO_MANUAL_0.7.1.md`.

## Correlação Resend

- [ ] Resend recebe tag `notification_id`
- [ ] A tag contém somente o ID lógico da outbox
- [ ] Webhook correlaciona entrega pela tag
- [ ] Webhook sem tag antiga continua correlacionando por `providerMessageId`
- [ ] `notification_id` inexistente usa fallback quando o `providerMessageId` é compatível
- [ ] Evidências conflitantes não atualizam entrega errada
- [ ] Webhook antes de `markSent` não fica perdido
- [ ] Webhook antes de `markDeliveryUncertain` não fica perdido
- [ ] `DELIVERY_UNCERTAIN` muda para `DELIVERED` quando confirmado
- [ ] Bounce/complaint/failure válidos resolvem entrega incerta conforme a máquina de estados
- [ ] Replay do webhook não duplica processamento

## Unmatched e manutenção

- [ ] Webhook válido sem correlação aparece como `UNMATCHED_PENDING`
- [ ] O mesmo evento é posteriormente reconciliado, sem documento duplicado
- [ ] Maintenance Worker aciona a reconciliação pelo endpoint já existente
- [ ] Evento antigo expira de forma controlada
- [ ] Eventos terminais são elegíveis à retenção técnica
- [ ] Painel mostra “Webhooks não correlacionados” quando houver pendências
- [ ] Evento pendente antigo produz alerta operacional

## Métricas e Artifact Registry

- [ ] Consumo Resend conta `providerAcceptedAt`
- [ ] `sentAt` + `providerAcceptedAt` não contam duas unidades
- [ ] `DELIVERY_UNCERTAIN` aceito pelo provider conta consumo lógico
- [ ] Mensagem não aceita não conta consumo lógico
- [ ] Aceitos pelo provedor e entregues são exibidos como conceitos distintos
- [ ] Artifact Registry é descrito como estimativa lógica
- [ ] A interface informa que camadas compartilhadas podem divergir do armazenamento faturado
