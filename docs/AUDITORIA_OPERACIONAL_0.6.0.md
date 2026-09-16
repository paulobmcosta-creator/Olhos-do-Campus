# Auditoria operacional — 0.6.0

## Escopo

A coleção `auditLogs` é append-only pela aplicação. A página global de auditoria é exclusiva do Administrador; Gestores continuam vendo o histórico funcional das ocorrências, não a auditoria global de segurança/administração.

Eventos ampliados incluem alterações de situação, categoria, local, prioridade, equipe, responsável, mensagens/notas, resolução/encerramento/reabertura, categorias, locais, equipes, SLA, calendário, exportação e exclusão de TEST.

## Filtros

Usuário/e-mail, tipo de ação, ocorrência, período, tipo de alvo e alvo. A listagem é paginada por cursor.

## Minimização

Auditoria registra metadados necessários à responsabilização institucional, evitando duplicação desnecessária do texto integral de observações ou dados de segurança.
