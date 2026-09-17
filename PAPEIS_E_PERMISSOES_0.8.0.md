# MATRIZ DE PAPÉIS E PERMISSÕES — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Visão Geral dos Papéis Administrativos

O sistema implementa o princípio do menor privilégio através de 3 papéis bem definidos:

1. **Administrador (`Administrador`)**: Controle total sobre o sistema, parâmetros de configuração, categorias, locais, equipes, usuários administrativos e auditoria global.
2. **Gestor (`Gestor`)**: Supervisão e operação tática sobre todas as ocorrências do campus, triagem avançada, reabertura, cancelamento e publicação de fotografias de solução.
3. **Atendente (`Atendente`)**: Operação de execução pontual de manutenção, com acesso **estritamente restrito às ocorrências atribuídas individualmente ao próprio usuário** (`assignedToAdminUserId === user.id`).

---

## 2. Matriz Comparativa de Permissões (RBAC)

| Ação / Recurso | Administrador | Gestor | Atendente | Observações |
| :--- | :---: | :---: | :---: | :--- |
| **Visualizar lista global de ocorrências** | ✅ | ✅ | ❌ | Atendente vê apenas aba "Minhas Ocorrências" |
| **Consultar detalhe de qualquer ocorrência** | ✅ | ✅ | ❌ | Atendente só acessa ocorrência atribuída a si |
| **Executar 7 transições autorizadas** | ✅ | ✅ | ✅ | Atendente apenas na ocorrência atribuída |
| **Transições estruturais (Cancelamento / Reabertura)**| ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Alterar Categoria / Local / Prioridade** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Alterar Equipe / Atribuir Responsável** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Adicionar Mensagem Pública** | ✅ | ✅ | ✅ | Atendente apenas na ocorrência atribuída |
| **Inserir Nota Interna (`ADMIN_ONLY`)** | ✅ | ❌ | ❌ | Restrito a Administradores |
| **Inserir Nota Interna (`ADMINS_AND_MANAGERS`)** | ✅ | ✅ | ❌ | Restrito a Administradores e Gestores |
| **Inserir Nota Interna (`RESPONSIBLE_TEAM`)** | ✅ | ✅ | ✅ | Atendente apenas na ocorrência atribuída |
| **Adicionar Foto de Solução** | ✅ | ✅ | ✅ | Foto criada com status `INTERNAL` |
| **Tornar Foto de Solução Pública** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Excluir Foto de Solução** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Vincular Duplicidade** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Visualizar Auditoria Global** | ✅ | ❌ | ❌ | Restrito a Administradores |
| **Visualizar Analytics Global** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Exportar Relatórios CSV/PDF** | ✅ | ✅ | ❌ | Bloqueado 403 para Atendente |
| **Gerenciar Locais, Categorias, Equipes e Usuários**| ✅ | ❌ | ❌ | Restrito a Administradores |
| **Editar Configuração Operacional e E-mails** | ✅ | ❌ | ❌ | Restrito a Administradores |

---

## 3. Regra Fundamental de Pertencimento a Equipes (Membership)

> **REGRA DE ISOLAMENTO**:
> Pertencer a uma equipe (ex: membro de `team-ti` ou `team-cgao`) **NÃO** concede privilégios de leitura ou escrita sobre todas as ocorrências daquela equipe.
> O Atendente possui autorização exclusivamente quando seu ID de usuário estiver explicitamente registrado no campo `assignedToAdminUserId` da ocorrência.
