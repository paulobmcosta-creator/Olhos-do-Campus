# Equipes/Setores responsáveis

## Entidade

Coleção `operationalTeams/{teamId}` com nome, descrição, estado ativo, ordem, membros e metadados de criação/atualização.

## Regras

- somente Administrador cria, edita, ativa/desativa e altera membros;
- membros devem ser Administrador ou Gestor ativos;
- usuários podem integrar múltiplas equipes;
- `department` legado não é mecanismo de autorização e não é convertido automaticamente;
- equipe já utilizada historicamente deve ser desativada, não apagada fisicamente.

## Ocorrências

A ocorrência pode armazenar:

- `assignedTeamId`;
- `assignedTeamNameSnapshot`;
- `assignedToAdminUserId` opcional;
- `assignedToDisplayNameSnapshot` opcional.

O responsável individual, quando informado com equipe selecionada, precisa integrar essa equipe. Trocar a equipe remove automaticamente um responsável incompatível e gera evento de histórico.
