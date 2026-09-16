# Indicadores — 0.6.0

Rota: `/administracao/indicadores`, disponível a Administrador e Gestor.

## Período

Padrão: últimos 30 dias. Atalhos: Hoje, 7 dias, 30 dias, 90 dias, Ano atual e intervalo personalizado.

## Indicadores

- abertas atualmente considerando os filtros dimensionais (categoria, área, ambiente, prioridade, situação, equipe e responsável); o período não reduz artificialmente o estoque atual;
- criadas no período;
- urgentes/emergenciais;
- SLA vencido;
- sem equipe;
- sem responsável;
- resolvidas e encerradas;
- reaberturas;
- média e mediana da primeira resposta em horas úteis;
- média e mediana do tempo total de encerramento em horas corridas;
- média e mediana do tempo efetivo em horas úteis;
- percentual de primeira resposta no prazo;
- percentual de conclusão no SLA.

Distribuições: categoria, situação, prioridade, Bloco/Área, equipe e responsável.

## Integridade estatística

A camada analítica separa coortes: primeira resposta e distribuições usam ocorrências abertas no período; tempo total, tempo efetivo e SLA de conclusão usam ocorrências encerradas no período; reaberturas usam `lastReopenedAt`. Contagens usam agregações Firestore. Cada coorte que exige distribuição/média/mediana é limitada a 5.000 documentos; se ultrapassar esse limite, somente essas métricas são marcadas como indisponíveis, sem apresentar amostra truncada como total.
