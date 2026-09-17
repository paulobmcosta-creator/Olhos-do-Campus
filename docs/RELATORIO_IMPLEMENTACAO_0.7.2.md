# Relatório de implementação — versão 0.7.2

## 1. Base e escopo

Fonte de verdade: ZIP integral `olhos-do-campus-0.7.1.zip`.

A árvore 0.7.1 foi reaberta e inspecionada antes das alterações. Confirmaram-se os três grupos residuais: ausência do ID lógico no request Resend, descarte definitivo de webhook não correlacionado e métricas baseadas apenas em `sentAt`. A terminologia do Artifact Registry também permanecia ambígua no painel.

Não foram reabertas as correções de R2, política de cleanup do Artifact Registry, Pages/Cloud Run, região ou baseline Node.

## 2. Tag e abstração de provider

`EmailProvider.send` recebe `EmailSendRequest`, contendo mensagem, idempotency key e `notificationId`. O domínio não conhece sintaxe de tags do Resend.

`ResendEmailProvider` valida o ID lógico SHA-256 de 64 caracteres e gera exclusivamente `notification_id=<id>`. Nenhuma PII é adicionada.

## 3. Parser e correlação

O parser de webhook reconhece `data.tags`, lê somente `notification_id` e rejeita valor fora do formato permitido.

Ordem de correlação:

1. ID lógico direto;
2. fallback por `providerMessageId`.

Quando as evidências são incompatíveis, o evento é `INCONSISTENT` e nenhuma outbox potencialmente errada é atualizada.

## 4. Unmatched e reconciliação

`notificationWebhookEvents` passou a registrar metadados mínimos com schemaVersion 2 e estados `UNMATCHED_PENDING`, `PROCESSED`, `UNMATCHED_EXPIRED` e `INCONSISTENT`.

O mesmo documento do event ID evolui de pendente para processado/expirado. A reconciliação é integrada ao endpoint de manutenção já chamado pelo Worker, em lote de até 50, com backoff, limite de tentativas, prazo de 72 horas e retenção terminal de 90 dias.

Foram adicionados somente os índices compostos exigidos pelas queries reais de pending, evento pendente mais antigo e retenção terminal. Firestore client-side continua deny-all.

## 5. Corrida e DELIVERY_UNCERTAIN

A tag permite correlação enquanto a outbox ainda está `PROCESSING`, antes de existir `providerMessageId` local.

O webhook aplica a máquina monotônica existente. `markSent` e `markDeliveryUncertain` permanecem condicionados transacionalmente a `PROCESSING` + owner da lease. Uma escrita tardia, portanto, não rebaixa `DELIVERED`, `BOUNCED` ou `COMPLAINED`.

Eventos válidos também resolvem `DELIVERY_UNCERTAIN` conforme sua categoria.

## 6. Métricas Resend

As referências operacionais diária/mensal passam a contar documentos com `providerAcceptedAt`. Cada outbox é uma unidade e não existe soma de `sentAt` + `providerAcceptedAt`.

O painel distingue aceitos, enviados, entregues, pending, retry, uncertain, bounced, complained, falhas e webhooks unmatched. O mais antigo unmatched também é observado.

## 7. Artifact Registry

A política de cleanup 0.7.1 foi preservada. Somente a apresentação mudou para “Soma lógica aproximada das imagens observadas”, com explicação explícita de que camadas compartilhadas podem divergir do armazenamento faturado.

## 8. Segurança

- nenhuma nova coleção acessível pelo browser;
- nenhuma persistência de payload bruto de webhook;
- nenhum IP/header completo/secret/API key;
- tag sem PII;
- conflitos de correlação não atualizam entrega;
- manutenção continua autenticada por HMAC;
- nenhum serviço novo.

## 9. Validação

Os resultados efetivamente executados são registrados em `TESTES_0.7.2.md`. A baseline Node permanece `>=22.22.2 <23`; não foi rebaixada para acomodar o sandbox.
