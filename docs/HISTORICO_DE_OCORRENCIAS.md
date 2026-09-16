# Histórico de ocorrências — versão 0.5.0

## Finalidade

O histórico funcional é persistido na subcoleção:

```text
occurrences/{occurrenceId}/events/{eventId}
```

Ele registra fatos relevantes do ciclo de vida da ocorrência sem fazer crescer o documento principal com arrays ilimitados.

## Append-only

No fluxo ordinário:

- evento é criado uma única vez;
- evento não é atualizado;
- evento não é excluído;
- timestamp e autor não são substituídos;
- o repositório expõe somente leitura da coleção de eventos;
- alterações de estado materializado e eventos correspondentes são persistidos na mesma transação Firestore.

As regras do Firestore impedem qualquer acesso direto do cliente Web, inclusive edição/exclusão.

## Visibilidade

### `PUBLIC`

Pode integrar a visão pública após serialização por lista positiva.

Exemplos:

- criação;
- mudança pública de situação;
- mensagem pública;
- marcação/desvinculação de duplicidade;
- resolução;
- reabertura.

A serialização pública não inclui autor nominal, UID, `adminUserId` ou papel administrativo real. Mensagens públicas exibem identificação institucional genérica: **Equipe responsável**.

### `INTERNAL`

Aparece somente na administração.

Exemplos:

- alteração de prioridade;
- atribuição administrativa;
- observação interna;
- sinalização técnica de risco inicial.

## Mensagem pública

```text
eventType = PUBLIC_MESSAGE_ADDED
visibility = PUBLIC
publicDescription = texto destinado ao comunicante
```

Uma primeira mensagem pública define `firstPublicResponseAt` no estado materializado.

## Observação interna

```text
eventType = INTERNAL_NOTE_ADDED
visibility = INTERNAL
internalDescription = texto administrativo
```

O texto interno nunca é incluído no endpoint público de acompanhamento.

## Histórico versus `auditLogs`

Eventos da ocorrência descrevem o **domínio funcional**. `auditLogs` registra **auditoria administrativa e de segurança**. Algumas mudanças podem gerar ambos os registros quando houver finalidade distinta, sem copiar desnecessariamente o conteúdo integral da ocorrência.

A chave de acompanhamento nunca aparece em nenhuma das duas estruturas.
