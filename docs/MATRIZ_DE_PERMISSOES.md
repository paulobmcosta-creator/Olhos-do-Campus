# Matriz de permissões — versão 0.6.0

Este documento ativo referencia a matriz detalhada em [`MATRIZ_DE_PERMISSOES_0.6.0.md`](./MATRIZ_DE_PERMISSOES_0.6.0.md).

A versão 0.6.0 possui somente dois papéis administrativos ativos:

- **Administrador**: administra o sistema e também pode administrar ocorrências;
- **Gestor**: administra ocorrências, sem acesso à administração estrutural ou de segurança.

| Capacidade | Administrador | Gestor |
|---|---:|---:|
| Visualizar todas as ocorrências | Sim | Sim |
| Alterar situação, prioridade, categoria e local da ocorrência | Sim | Sim |
| Atribuir equipe e responsável | Sim | Sim |
| Mensagem pública e observação interna conforme audiência | Sim | Sim |
| Fotografias operacionais conforme política | Sim | Sim |
| Dashboard e indicadores | Sim | Sim |
| Exportar CSV/XLSX/PDF | Sim | Sim |
| Gerenciar usuários e papéis | Sim | Não |
| Resolver papel legado `Atendente` | Sim | Não |
| Gerenciar equipes/setores | Sim | Não |
| Gerenciar categorias | Sim | Não |
| Gerenciar locais | Sim | Não |
| Gerenciar SLA e calendário útil | Sim | Não |
| Auditoria global | Sim | Não |
| Excluir definitivamente ocorrência `TEST` | Sim | Não |
| Excluir ocorrência `REAL` | Não | Não |

`Atendente` **não é papel ativo**. O valor pode existir somente em documento legado e permanece bloqueado até que um Administrador escolha explicitamente entre convertê-lo para Gestor ou inativá-lo. Não há promoção automática.

Toda autorização crítica é aplicada no backend. A ocultação de ações no frontend é apenas uma camada de interface.
