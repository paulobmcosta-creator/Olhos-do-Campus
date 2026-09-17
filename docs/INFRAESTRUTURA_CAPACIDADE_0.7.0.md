# Painel Infraestrutura e capacidade — versão 0.7.0

## Acesso e objetivo

A rota `/administracao/infraestrutura` é exclusiva do Administrador. Ela oferece referência operacional para acompanhamento de capacidade e prevenção de custos inesperados. Gestor não possui a rota, o link nem autorização na API.

O painel não lê faturamento e não conhece o contrato comercial vigente. Valores são observados, estimados ou configurados como referência; não são promessa de gratuidade.

## Indicadores

- **R2:** quantidade e bytes de objetos, principais/miniaturas, inventário completo, objeto mais antigo e data do levantamento. Ocupação instantânea em GB não é GB-mês; o faturamento R2 considera uso ao longo do tempo.
- **Firestore:** contagem agregada de documentos por coleção e total. A estimativa lógica de bytes só é executada pela ação administrativa explícita “Estimar armazenamento lógico”, com paginação, limite de 5.000 leituras, método, quantidade amostrada e cobertura registrados. Ela soma aproximadamente path + JSON e não inclui índices/overhead nem substitui métricas/fatura do Google Cloud.
- **Resend:** destinatários enviados hoje/mês, pendentes, retry, falhos, delivered, bounced, complained e datas operacionais. Uma mensagem para cinco destinatários conta cinco unidades.
- **Cleanup/reconciliação:** tarefas e objetos pendentes, metadados sem objeto, órfãos e divergência de tamanho.
- **Artifact Registry:** bytes e versões do último snapshot externo ou “não coletado”.

Snapshots são agregados, idempotentes por período e não duplicam ocorrências nem armazenam e-mail, IP, descrição, chave ou outros dados pessoais. O histórico oferece períodos de 30, 90 e 365 dias, tabela acessível, evolução do R2 e projeções simples. Projeção é extrapolação baseada no histórico; pouca amostra produz mensagem de insuficiência e nunca um valor fictício.

## Referências e níveis

Defaults verificados em 2026-08-18:

| Serviço | Referência operacional inicial |
|---|---:|
| R2 | 10.000.000.000 bytes |
| Firestore | 1.073.741.824 bytes |
| Artifact Registry | 536.870.912 bytes |
| Resend diário | 100 destinatários |
| Resend mensal | 3.000 destinatários |

Limiar padrão: Atenção 70%, Alerta 85% e Crítico 95%. O Administrador pode atualizar valores, limiares e `referenceVerifiedAt` com controle de versão e auditoria. Os níveis apenas alertam: não removem dados nem desabilitam serviços.

## Operação

- **Atualizar levantamento:** captura snapshot agregado atual.
- **Estimar armazenamento lógico do Firestore:** informa previamente o teto de leituras, executa amostragem paginada e grava somente o agregado; a rotina periódica não dispara esse scan.
- **Reconciliar R2 × Firestore:** a ação do painel é dry-run/somente relatório.
- **Processar cleanup:** atua somente em tarefas técnicas já registradas, de modo limitado.
- **Reprocessar notificações:** recoloca apenas estados elegíveis, preservando idempotência.
- **Artifact Registry:** use o script separado e credencial operacional; o backend não recebe permissão adicional.

Execute reconciliação depois de migração, incidente de upload ou divergência de contagem. Execute cleanup quando existirem tarefas de compensação pendentes. O monitoramento jamais apaga automaticamente ocorrências, histórico/auditoria, metadados válidos ou fotografias reais referenciadas. Somente snapshots técnicos diários antigos podem ser compactados após existir agregado mensal, conforme regra documentada no código.

Se capacidade se aproximar dos limiares, confira a métrica no console do provedor e o contrato vigente antes de mudar referência, retenção ou arquitetura. Qualquer retenção de dados institucionais exige decisão futura explícita.
