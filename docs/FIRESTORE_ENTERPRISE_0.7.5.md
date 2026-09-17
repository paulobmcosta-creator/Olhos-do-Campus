# Firestore Enterprise — versão 0.7.5

## Contexto

O ambiente real usa o banco nomeado `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`, no projeto `gen-lang-client-0120954905`, região `us-west1`, edição **Enterprise**.

Durante o primeiro deploy da árvore 0.7.4 pós-homologação, `firestore.rules` e `storage.rules` compilaram, mas a etapa de índices falhou quando a Firebase CLI tentou atualizar configuração de índice de campo em `attempts.attemptNumber` por meio de `fieldOverrides`.

Mensagem observada:

```text
Enterprise Edition does not support updating field index configuration.
```

## Correção consolidada

`firestore.indexes.json` não contém mais `fieldOverrides`. Os campos da subcoleção `attempts` usados operacionalmente foram materializados como índices explícitos de collection group, `DENSE`, não multikey:

| Campo | Ordem | Escopo |
|---|---|---|
| `providerMessageId` | ASCENDING | COLLECTION_GROUP |
| `providerAcceptedAt` | ASCENDING | COLLECTION_GROUP |
| `providerAcceptedAt` | DESCENDING | COLLECTION_GROUP |
| `createdAt` | ASCENDING | COLLECTION_GROUP |
| `status` | ASCENDING | COLLECTION_GROUP |
| `attemptNumber` | ASCENDING | COLLECTION_GROUP |

Os índices compostos preexistentes de `adminUsers`, `auditLogs`, `notificationOutbox`, `notificationWebhookEvents` e `occurrences` foram preservados.

## Evidência de implantação

As regras foram publicadas com sucesso por deploy seletivo de `firestore:rules,storage`.

Depois da correção do manifesto, a listagem real mostrou os seis índices `attempts` aceitos pelo banco em `STATE: CREATING`. A evidência disponibilizada para o fechamento desta versão não contém uma listagem posterior comprovando os seis como `READY`.

## Gate operacional

Antes de colocar tráfego produtivo dependente dessas consultas, confirmar no projeto real que os seis índices `attempts` estão `READY`.

A verificação pode ser feita com:

```bash
DB="ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf"
PROJECT="gen-lang-client-0120954905"

gcloud firestore indexes composite list \
  --project="$PROJECT" \
  --database="$DB" \
  --filter="COLLECTION_GROUP:attempts"
```

Não reintroduzir `fieldOverrides` para `attempts` neste banco Enterprise.
