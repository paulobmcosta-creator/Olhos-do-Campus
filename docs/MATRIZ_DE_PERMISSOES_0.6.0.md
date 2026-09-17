# Matriz de permissões — 0.6.0

> Documento histórico da matriz introduzida na 0.6.0. Para as permissões adicionais de notificações e infraestrutura da versão ativa, consulte `MATRIZ_DE_PERMISSOES.md`.

| Operação | Administrador | Gestor |
|---|:---:|:---:|
| Visualizar todas as ocorrências | ✓ | ✓ |
| Dashboard operacional | ✓ | ✓ |
| Indicadores | ✓ | ✓ |
| Filtros/paginação/exportação | ✓ | ✓ |
| Alterar situação/prioridade | ✓ | ✓ |
| Corrigir categoria/local | ✓ | ✓ |
| Atribuir equipe/responsável | ✓ | ✓ |
| Mensagem pública | ✓ | ✓ |
| Nota interna conforme audiência | ✓ | ✓ |
| Duplicidade/resolução/reabertura | ✓ | ✓ |
| Fotografias operacionais | ✓ | ✓ |
| Criar/editar usuários | ✓ | — |
| Resolver papel legado | ✓ | — |
| Criar/editar equipes | ✓ | — |
| Criar/editar catálogo de categorias | ✓ | — |
| Criar/editar cadastro de locais | ✓ | — |
| Configurar SLA | ✓ | — |
| Configurar calendário/exceções | ✓ | — |
| Auditoria global | ✓ | — |
| Expurgar ocorrência TEST | ✓ | — |
| Expurgar ocorrência REAL | — | — |

## Papel legado

`Atendente` não pertence a `ADMIN_ROLES`. Um documento legado com esse valor é detectado, mas não autoriza sessão administrativa. Um Administrador deve optar explicitamente por conversão em Gestor ou inativação.

## Regra de aplicação

Permissões críticas são verificadas no backend. Ocultar um botão no frontend não é tratado como mecanismo de autorização.
