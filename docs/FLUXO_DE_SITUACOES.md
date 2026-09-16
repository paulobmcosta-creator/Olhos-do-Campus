# Fluxo de situações — versão 0.6.0

## Situações preservadas

1. Recebida
2. Em triagem
3. Em análise
4. Encaminhada ao setor responsável
5. Em atendimento
6. Aguardando material
7. Aguardando contratação ou serviço externo
8. Resolvida
9. Não procedente
10. Duplicada
11. Cancelada

A máquina de estados permanece centralizada em `server/domain/occurrenceStateMachine.ts`. Administrador e Gestor usam a mesma regra operacional; não existem transições arbitrárias.

## Fluxo principal

```text
Recebida
  ↓
Em triagem
  ↓
Em análise
  ↓
Encaminhada ao setor responsável
  ↓
Em atendimento
  ↓
Resolvida
```

## Matriz de transições ordinárias

`✓` = permitida. `—` = proibida. Permanecer na mesma situação não constitui alteração efetiva.

| Origem \\ Destino | Recebida | Em triagem | Em análise | Encaminhada | Em atendimento | Aguard. material | Aguard. externo | Resolvida | Não procedente | Duplicada | Cancelada |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Recebida** | — | ✓ | — | — | — | — | — | — | — | — | ✓ |
| **Em triagem** | — | — | ✓ | — | — | — | — | — | ✓ | ✓ | ✓ |
| **Em análise** | — | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **Encaminhada** | — | — | ✓ | — | ✓ | ✓ | ✓ | — | — | — | ✓ |
| **Em atendimento** | — | — | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **Aguard. material** | — | — | — | ✓ | ✓ | — | ✓ | — | — | — | ✓ |
| **Aguard. externo** | — | — | — | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| **Resolvida** | — | — | reabertura* | — | — | — | — | — | — | — | — |
| **Não procedente** | — | — | reabertura* | — | — | — | — | — | — | — | — |
| **Duplicada** | — | — | reabertura* | — | — | — | — | — | — | — | — |
| **Cancelada** | — | — | reabertura* | — | — | — | — | — | — | — | — |

`*` Reabertura por Administrador ou Gestor, sempre para `Em análise`, segundo as regras de domínio e `expectedVersion`.

## Semântica institucional

- **Recebida**: registrada e ainda não submetida à triagem administrativa.
- **Em triagem**: conferência de categoria, local, risco, prioridade e encaminhamento.
- **Em análise**: avaliação técnica ou administrativa da providência.
- **Encaminhada ao setor responsável**: uma equipe/setor foi formalmente indicada; a execução pode ainda não ter iniciado.
- **Em atendimento**: há atuação efetiva sobre a providência.
- **Aguardando material**: depende de material, peça ou insumo e pausa o SLA efetivo de conclusão.
- **Aguardando contratação ou serviço externo**: depende de contratação, fornecedor ou agente externo e pausa o SLA efetivo de conclusão.
- **Resolvida**: providência concluída; define `closedAt` e `resolvedAt`.
- **Não procedente**: problema não confirmado, sem providência de infraestrutura aplicável ou fora do escopo; define `closedAt`, sem `resolvedAt`.
- **Duplicada**: problema já tratado por outra ocorrência; define `closedAt`.
- **Cancelada**: encerramento administrativo por motivo diverso; define `closedAt`.

## Primeira resposta e SLA

A primeira resposta é definida **uma única vez** pela primeira mudança de situação que produza alteração pública. Abrir a ocorrência, visualizar, atribuir, corrigir categoria/local, alterar prioridade, inserir nota interna ou enviar mensagem pública isoladamente não define `firstPublicResponseAt`.

O SLA de conclusão pausa somente em `Aguardando material` e `Aguardando contratação ou serviço externo`; o tempo total permanece correndo. Estados terminais encerram o relógio operacional.

## Reabertura

Administrador e Gestor podem reabrir um estado terminal para `Em análise`. A reabertura:

- incrementa `version`;
- registra `OCCURRENCE_REOPENED`;
- incrementa a contagem de reaberturas;
- remove `closedAt`;
- remove `resolvedAt` quando aplicável;
- retoma o SLA de conclusão segundo o snapshot histórico, sem reiniciar `createdAt`;
- desconta do SLA efetivo o intervalo em que a ocorrência permaneceu encerrada, embora esse intervalo continue pertencendo ao tempo total cronológico.

## Testes

A regra de transição é verificada por `tests/occurrenceStateMachine.test.ts`; regras adicionais de SLA e reabertura estão em `tests/sla060.test.ts` e testes de serviço.
