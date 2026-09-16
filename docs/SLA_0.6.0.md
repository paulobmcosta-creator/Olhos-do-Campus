# SLA — versão 0.6.0

## 1. Princípio

O SLA da 0.6.0 é calculado exclusivamente no backend, em **horas úteis**, usando o timezone IANA `America/Sao_Paulo`. O cálculo não utiliza offset fixo como regra de negócio.

Cada ocorrência recebe um snapshot da política e do calendário aplicáveis. Alterações futuras de configuração não reescrevem silenciosamente ocorrências existentes.

## 2. Primeira resposta

A primeira resposta ocorre na **primeira alteração de situação que se torna visível no acompanhamento público**. Abrir, visualizar, atribuir, corrigir categoria/local, mudar prioridade, registrar observação interna ou publicar uma mensagem não define, isoladamente, `firstPublicResponseAt`.

Metas iniciais:

| Prioridade | Horas úteis |
|---|---:|
| Baixa | 30 |
| Normal | 20 |
| Alta | 10 |
| Urgente | 4 |
| Emergencial | 2 |

Antes da primeira resposta, uma mudança de prioridade recalcula o prazo sem reiniciar o relógio. Depois de definida, a primeira resposta e seu resultado histórico são preservados.

## 3. SLA-base de conclusão

| Categoria | Horas úteis |
|---|---:|
| Limpeza e conservação | 30 |
| Segurança física | 40 |
| Instalações elétricas | 50 |
| Instalações hidráulicas | 50 |
| Pragas e animais | 50 |
| Iluminação | 60 |
| Acessibilidade | 80 |
| Portas e janelas | 80 |
| Climatização | 100 |
| Sinalização | 100 |
| Equipamentos instalados | 120 |
| Mobiliário | 120 |
| Estrutura predial | 160 |
| Áreas externas | 160 |
| Outros | 120 |

## 4. Multiplicadores

| Prioridade | Fator |
|---|---:|
| Baixa | 1,50 |
| Normal | 1,00 |
| Alta | 0,80 |
| Urgente | 0,60 |
| Emergencial | 0,40 |

A meta de conclusão é `SLA-base × multiplicador`. Todos os valores são administráveis pelo Administrador e versionados.

## 5. Tempo total × tempo efetivo

**Tempo total**: diferença cronológica entre `createdAt` e `closedAt` ou o momento atual. Nunca pausa.

**Tempo efetivo de SLA**: minutos úteis transcorridos, descontados os períodos de pausa operacional.

## 6. Pausas

Pausam somente o SLA efetivo de conclusão:

- Aguardando material;
- Aguardando contratação ou serviço externo.

A entrada gera `SLA_PAUSED`. A saída calcula os minutos úteis de pausa, acumula-os, desloca os marcos de SLA e gera `SLA_RESUMED`.

## 7. Encerramento e reabertura

Estados terminais: Resolvida, Não procedente, Duplicada e Cancelada. Todos definem `closedAt`; apenas Resolvida define `resolvedAt`.

Ao encerrar, o SLA recebe `completedAt` e `resolutionOutcome`. Ao reabrir, o encerramento do SLA é removido, mas o intervalo em que a ocorrência permaneceu terminal é acumulado como suspensão do relógio efetivo e desloca os prazos. O tempo total cronológico continua correndo e não é reduzido pela reabertura.

## 8. Correção de categoria/prioridade

A recategorização ou mudança de prioridade não altera `createdAt` nem zera o relógio. O novo alvo é calculado sobre a regra atual escolhida para a ocorrência, preservando tempo útil transcorrido e pausas anteriores. Se a correção explícita ocorrer depois de um encerramento, o resultado de conclusão é recalculado contra o mesmo `completedAt`, sem fabricar novo tempo. A mudança global da matriz vale por padrão apenas para novas ocorrências.

## 9. Estado do SLA

- `ON_TIME`: antes da faixa de proximidade;
- `NEAR_DUE`: restante igual ou inferior a 20% do alvo total;
- `BREACHED`: prazo vencido;
- `PAUSED`: pausa operacional vigente;
- `COMPLETED`: ocorrência encerrada.

O limiar inicial de 20% é configurável.

## 10. Campos persistidos

O snapshot persiste metas, prazos, resultados, pausas, versão da política e snapshot do calendário/exceções. O `effectiveElapsedBusinessMinutes` é calculado pelo servidor a partir desses dados, não duplicado como estado persistente.
