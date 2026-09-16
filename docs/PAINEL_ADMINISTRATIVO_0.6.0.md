# Painel administrativo — 0.6.0

## Dashboard

A página inicial permanece operacional e enxuta. Os cards priorizam urgentes/emergenciais, SLA vencido, ocorrências sem encaminhamento, em atendimento, aguardando providência, resolvidas recentemente e novas no dia. Os cards direcionam para a lista filtrada.

## Lista

A listagem utiliza paginação por cursor e tamanhos 25/50/100, padrão 25. Mantém filtros e ordenação durante a navegação. Não usa offset como mecanismo principal e não carrega toda a coleção para paginar no navegador.

Filtros previstos na API/UI incluem protocolo, palavra-chave limitada por tokens, datas, categoria, área, ambiente, situação, prioridade, equipe, responsável, risco, SLA, ausência de encaminhamento, fotografias, reabertura e classificação REAL/TEST.

A busca por palavra-chave usa tokenização limitada e não pretende substituir mecanismo dedicado de full-text search. Não há scan ilimitado da coleção.

## Ordenação

Padrão: prioridade → prazo de SLA → antiguidade. Alternativas: mais recentes, mais antigas, prioridade, SLA e protocolo.

## Polling

Dashboard e lista verificam alterações a cada 60 segundos. A interface não substitui silenciosamente dados abertos; exibe aviso e ação “Atualizar agora”. Na tela de detalhe, mudança de versão remota é sinalizada sem sobrescrever formulário em edição.

## Acessibilidade básica

Filtros têm labels, tabelas possuem cabeçalhos, prioridades/SLA usam texto além de cor, ações têm nomes acessíveis e atualizações são comunicadas por regiões de status.


## Estratégia Firestore e índices

Filtros de igualdade são aplicados diretamente no Firestore. Períodos e estados de SLA usam desigualdades; nesses casos o primeiro `orderBy` acompanha o campo de intervalo e os critérios operacionais entram como desempate. O cursor serializa exatamente os mesmos campos de ordenação, incluindo o ID documental.

`firestore.indexes.json` contém índices compostos para: ordenação operacional padrão, período de abertura, período de encerramento, reaberturas, SLA vencido, faixa de próximo vencimento e faixa dentro do prazo, além de consultas administrativas frequentes por status/equipe/responsável e auditoria. Não foram criadas combinações especulativas para todas as permutações de filtros. Se um filtro combinado futuro exigir novo índice, a API deve receber o índice deliberadamente; não deve regredir para carregar toda a coleção em memória.
