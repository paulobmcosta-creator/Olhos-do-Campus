# ARQUITETURA DE NOTIFICAÇÕES E OUTBOX — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Eventos Institucionais de Notificação

| Tipo de Evento | Gatilho Operacional | Destinatário Resolvido | Provedor Padrão |
| :--- | :--- | :--- | :---: |
| **`OCCURRENCE_CREATED`** | Registro de nova ocorrência no portal público | E-mail da equipe inicial de acolhimento (`cgao.bsf@ifes.edu.br`) e e-mails operacionais configurados | `resend` / `ews` |
| **`OCCURRENCE_TEAM_ROUTED`** | Encaminhamento da ocorrência para um setor | `OperationalTeam.notificationEmail` do setor de destino | `ews` |
| **`OCCURRENCE_RESPONSIBLE_ASSIGNED`** | Atribuição da ocorrência a um responsável | `AdminUser.email` do servidor designado | `ews` |
| **`ADMIN_TEST`** | Teste controlado disparado pelo painel administrativo | E-mail informado pelo Administrador no teste | `resend` / `ews` |

---

## 2. Resolução de Destinatários e Segurança

1. **Resolução Exclusiva no Servidor**: Os destinatários de e-mail nunca são aceitos como parâmetros arbitrários do cliente HTTP; eles são sempre derivados no backend a partir das entidades persistidas (`OperationalTeam` e `AdminUser`).
2. **Sem Disparo em Massa por Membership**: O encaminhamento para uma equipe dispara notificação exclusivamente para o `notificationEmail` da equipe, sem enviar e-mails individuais aos membros da equipe.
3. **Kill Switch Global**: A configuração operacional `emailNotificationsEnabled = false` bloqueia todo o processamento de entrega do worker sem perder os registros de outbox.

---

## 3. Estratégia de Idempotência do Outbox

Para garantir resiliência e evitar disparos duplicados em retries de rede ou mutações recorrentes legítimas, a chave de idempotência (`idempotencyKey`) é composta por:

* **Criação**: `occurrence-created/{id}`
* **Roteamento de Equipe**: `occurrence-routed/{occurrenceId}/v{version}/{assignedTeamId}`
* **Atribuição Individual**: `occurrence-assigned/{occurrenceId}/v{version}/{assignedToAdminUserId}`

Essa estrutura garante:
* **Cenário A (Retry de rede do mesmo fato)**: Mesma versão e mesmo alvo $\rightarrow$ mesma chave de idempotência $\rightarrow$ reutiliza o item existente sem duplicar.
* **Cenário B (Reatribuição legítima subsequente)**: Versão incrementada $\rightarrow$ nova chave de idempotência $\rightarrow$ novo item de outbox criado e entregue normalmente.
