# Painel administrativo — base 0.6.0, atualizado na 0.7.0

## Extensões da 0.7.0

O dashboard preserva as filas da 0.6.0 e adiciona alertas agregados de capacidade, cleanup, falhas de notificação e snapshot desatualizado do Artifact Registry para o Administrador. O link “Infraestrutura e capacidade” e sua API são exclusivos do Administrador.

A página `/administracao/infraestrutura` contém resumo textual, tabelas com cabeçalhos, histórico 30/90/365 dias, gráfico SVG com alternativa tabular, referências configuráveis e ações manuais de snapshot, estimativa lógica paginada do Firestore, reconciliação, cleanup e retry. Cards reorganizam em coluna e tabelas densas usam overflow local em telas pequenas. Status não depende apenas de cor.

A área de configurações passou a expor `notificationEmails` e `emailNotificationsEnabled`, além de status/teste do Resend. O Gestor continua sem acesso a configurações estruturais, auditoria global, notificações ou infraestrutura.

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
