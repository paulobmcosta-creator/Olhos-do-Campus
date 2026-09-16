# Modelo de dados Firestore — versão 0.4.0

## 1. Princípios

1. O documento `occurrences/{id}` contém somente o estado materializado atual.
2. Histórico, mensagens e observações são eventos em subcoleção.
3. A chave de acompanhamento nunca é persistida em texto claro.
4. Imagens não são persistidas no Firestore.
5. Datas de domínio são `Timestamp` no Firestore e ISO 8601 na API.
6. O frontend não acessa o Firestore diretamente.
7. Snapshots textuais preservam o significado histórico mesmo após alterações de dados de referência.
8. `version` implementa concorrência otimista.

## 2. `occurrences/{occurrenceId}`

| Campo | Tipo Firestore | Obrigatório | Visibilidade HTTP | Finalidade |
|---|---|---:|---|---|
| `schemaVersion` | number | sim | não | versão do schema persistente |
| `protocol` | string | sim | pública/admin | identificador institucional imutável |
| `trackingKeyHash` | string | sim | nunca | derivação scrypt em base64 |
| `trackingKeySalt` | string | sim | nunca | salt aleatório em base64 |
| `categoryId` | string | sim | admin | ID estável da categoria |
| `categoryNameSnapshot` | string | sim | pública/admin como nome | snapshot histórico |
| `location` | map | sim | pública com lista positiva/admin | snapshot de localização |
| `description` | string | sim | pública/admin | descrição informada |
| `immediateRisk` | boolean | sim | pública/admin | informação do registro |
| `status` | string | sim | pública/admin | situação atual |
| `priority` | string | sim | somente admin | classificação administrativa |
| `assignedToAdminUserId` | string | não | somente admin | referência estável a `adminUsers` |
| `assignedToDisplayNameSnapshot` | string | não | somente admin | snapshot de exibição |
| `duplicateOfOccurrenceId` | string | não | nunca publicamente | ID interno do destino |
| `duplicateOfProtocol` | string | não | pública/admin | protocolo da ocorrência principal |
| `createdAt` | Timestamp | sim | ISO na API | tempo definido pelo servidor |
| `updatedAt` | Timestamp | sim | ISO na API | última alteração |
| `resolvedAt` | Timestamp | não | ISO na API | definido somente pela transição para Resolvida |
| `firstPublicResponseAt` | Timestamp | não | somente admin | primeira mensagem pública administrativa |
| `version` | number | sim | somente admin | optimistic locking; inicia em 1 |

### `location` persistida na ocorrência

```text
campusId?             string
campusName            string
buildingId?           string
buildingName          string
floor                 string
room                  string
complement?           string
isOther?              boolean
otherDescription?     string
```

A visão pública omite IDs estáveis e retorna somente os campos textuais deliberadamente públicos.

### Campos proibidos no documento

- `trackingKey` original;
- ID Token/App Check Token;
- endereço IP;
- nome/e-mail/matrícula/CPF do comunicante;
- arrays crescentes de eventos, mensagens ou notas;
- Data URL/base64/bytes de fotografia;
- credenciais.

## 3. `occurrences/{occurrenceId}/events/{eventId}`

| Campo | Tipo | Finalidade |
|---|---|---|
| `schemaVersion` | number | versão do evento |
| `eventType` | string | união discriminante |
| `visibility` | `PUBLIC`/`INTERNAL` | controla DTO público |
| `createdAt` | Timestamp | tempo do servidor |
| `actorType` | `SYSTEM`/`ADMIN` | origem do evento |
| `actorAdminUserId` | string opcional | autor administrativo estável |
| `actorUid` | string opcional | contexto técnico interno |
| `actorRoleSnapshot` | string opcional | papel no momento do evento |
| `actorDisplayNameSnapshot` | string opcional | exibição administrativa histórica |
| `publicDescription` | string opcional | texto público |
| `internalDescription` | string opcional | texto interno |
| `previousValue` | string opcional | valor anterior |
| `newValue` | string opcional | novo valor |
| `correlationId` | string | correlação da requisição |

Eventos mínimos suportados:

- `OCCURRENCE_CREATED`;
- `STATUS_CHANGED`;
- `PRIORITY_CHANGED`;
- `ASSIGNMENT_CHANGED`;
- `PUBLIC_MESSAGE_ADDED`;
- `INTERNAL_NOTE_ADDED`;
- `DUPLICATE_LINKED`;
- `DUPLICATE_UNLINKED`;
- `OCCURRENCE_RESOLVED`;
- `OCCURRENCE_REOPENED`.

O repositório de eventos não oferece métodos ordinários de update/delete. Atualizações de ocorrência criam eventos na mesma transação.

## 4. `protocolCounters/{year}`

```text
year          number
lastSequence  number
updatedAt     Timestamp
```

Cada ano possui contador independente. A leitura/incremento ocorre dentro da mesma transação que cria a ocorrência e seus eventos iniciais.

## 5. `categories/{categoryId}`

```text
name          string
description   string
active        boolean
sortOrder     number
schemaVersion number
createdAt     Timestamp
updatedAt     Timestamp
updatedBy     string
```

O formulário público carrega apenas `active == true`. A ocorrência preserva `categoryNameSnapshot`.

## 6. `locations/{locationId}`

Cada documento representa uma unidade/campus com hierarquia embutida:

```text
campusName    string
provisional   boolean
buildings[]
  id          string
  name        string
  floors[]
    id        string
    name      string
    rooms[]
      id      string
      name    string
schemaVersion number
createdAt     Timestamp
updatedAt     Timestamp
updatedBy     string
```

Os IDs são estáveis para seleção; a ocorrência recebe snapshot textual. As localizações atualmente fornecidas pelo seed são provisórias.

## 7. `systemSettings/operational`

```text
institutionDisplayName string
protocolPrefix          string
notificationEmails      string[]
autoAssignRisk          boolean
serviceNotice           string
schemaVersion           number
createdAt?              Timestamp
updatedAt               Timestamp
updatedBy               string
```

Somente Administrador altera a configuração. O bootstrap público expõe somente `institutionDisplayName` e `serviceNotice`; parâmetros administrativos completos são obtidos por rota protegida.

Nome fantasia, nome oficial e frase institucional permanecem em configuração de branding não editável.

## 8. `adminUsers/{adminUserId}` e `auditLogs/{auditLogId}`

Modelos preservados da fundação de segurança anterior. `adminUserId` é derivado do e-mail normalizado por SHA-256 para identificação estável. `auditLogs` registra auditoria administrativa/de segurança e não substitui os eventos da ocorrência.

## 9. Índices compostos

`firestore.indexes.json` contém:

| Coleção | Campos | Consulta efetiva |
|---|---|---|
| `adminUsers` | `role`, `active` | proteção transacional do último Administrador ativo |
| `occurrences` | `assignedToAdminUserId`, `status` | agregações de estados para Atendente |
| `occurrences` | `assignedToAdminUserId`, `priority` | urgentes/emergenciais do Atendente |
| `occurrences` | `assignedToAdminUserId`, `createdAt` | recebidas no dia para Atendente |
| `occurrences` | `status`, `resolvedAt` | resolvidas no período para Admin/Gestor |
| `occurrences` | `assignedToAdminUserId`, `status`, `resolvedAt` | resolvidas no período para Atendente |

Não foram adicionados índices para filtros secundários que, na 0.4.0, ainda são aplicados sobre leitura limitada.

## 10. Concorrência

- criação: transação sobre contador anual;
- atualização: `expectedVersion` deve igualar `version` atual;
- sucesso: `version + 1`;
- conflito: HTTP 409;
- duplicidade: cadeia é relida dentro da transação antes da persistência.

## 11. Limites

- listagem administrativa: máximo 100 itens retornados;
- detector de truncamento: leitura de até 101 documentos;
- eventos por ocorrência na API: limite defensivo de 500;
- paginação completa e pesquisa textual avançada: versão 0.6.0.

## 12. Fotografias

Não existe coleção Firestore de fotografias na 0.4.0. `PhotoRepository` é abstração independente; a implementação temporária usa memória do processo somente em ambiente permitido.
