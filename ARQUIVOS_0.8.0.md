# RELAÇÃO DE ARQUIVOS — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Resumo Quantitativo do Diff (0.7.7 $\rightarrow$ 0.8.0)

* **Baseline Canônica (0.7.7)**: 406 arquivos
* **Versão Homologada (0.8.0)**: 413 arquivos (mais documentação documental do Gate E)
* **Arquivos Adicionados**: 7 arquivos de código/teste + 8 arquivos de documentação
* **Arquivos Modificados**: 42 arquivos de código/configuração + 1 (`CHANGELOG.md`)
* **Arquivos Excluídos**: 0 arquivos (nenhuma exclusão acidental)

---

## 2. Arquivos Adicionados

| Caminho | Finalidade |
| :--- | :--- |
| `scripts/migrate080.ts` | Script de reconciliação de equipes, ativação da CGAO e suporte a `--dry-run`/`--apply`. |
| `scripts/cleanupArtificialLocations.ts` | Script de conciliação segura de ambientes por allowlist com `--dry-run`/`--apply`. |
| `tests/attendantRole080.test.ts` | Suíte de testes para as 29 operações de menor privilégio e 7 transições do papel Atendente. |
| `tests/locationManagement080.test.ts` | Suíte de testes para filtragem de locais inativos no público e exclusão segura. |
| `tests/teamRoutingNotifications080.test.ts` | Suíte de testes para roteamento de equipes, CGAO, outbox e regressão GD-F001. |
| `tests/migrate080.test.ts` | Suíte de testes para planejamento e execução transacional da migração 0.8.0. |
| `tests/cleanupArtificialLocations.test.ts` | Suíte de testes para a política de exclusão por allowlist de ambientes artificiais. |
| `RELATORIO_IMPLEMENTACAO_0.8.0.md` | Relatório consolidado de implementação técnica da versão 0.8.0. |
| `TESTES_0.8.0.md` | Relatório detalhado de execução e aprovação de testes. |
| `ARQUIVOS_0.8.0.md` | Este documento com o mapa completo de arquivos e alterações. |
| `MIGRACAO_0.8.0.md` | Guia operacional para execução segura da migração 0.8.0. |
| `PAPEIS_E_PERMISSOES_0.8.0.md` | Matriz definitiva de papéis (Administrador, Gestor, Atendente) e controle de acesso. |
| `NOTIFICACOES_0.8.0.md` | Arquitetura de notificações, eventos institucionais e idempotência de outbox. |
| `INSTALACAO_E_IMPLANTACAO_0.8.0.md` | Instruções completas para instalação local e roteiro de implantação. |
| `FECHAMENTO_0.8.0.md` | Relatório formal de fechamento e auditoria da release 0.8.0. |

---

## 3. Principais Arquivos Modificados por Componente

### 3.1. Modelos e Tipos de Domínio
* `server/models/occurrenceDomain.ts`: Inclusão do papel `Atendente`, permissões granulares e campos de roteamento.
* `server/models/notificationDomain.ts`: Definição de eventos `OCCURRENCE_TEAM_ROUTED`, `OCCURRENCE_RESPONSIBLE_ASSIGNED` e tipagem opcional de `teamName` e `responsibleName`.
* `src/models/admin.ts` e `src/models/operations.ts`: Tipos TypeScript do frontend sincronizados com o backend.

### 3.2. Serviços e Domínio
* `server/domain/occurrenceStateMachine.ts`: Definição das 7 transições autorizadas para o papel Atendente.
* `server/domain/notificationOutbox.ts`: Builders de eventos de roteamento e atribuição com serialização defensiva.
* `server/services/adminAuthorizationService.ts`: Regras de menor privilégio e escopo por atribuição individual.
* `server/services/occurrenceService.ts`: Acolhimento inicial pela CGAO, emissão de eventos e sanitização.
* `server/services/operationalAdminService.ts`: Validações de equipe inicial, e-mails setoriais e integridade referencial de locais.

### 3.3. Repositórios
* `server/repositories/locationRepository.ts`: Método `listActiveForPublic()`, `isLocationReferenced()` e suporte a reativação.
* `server/repositories/notificationOutboxRepository.ts`: Serialização resiliente de `templateData` sem valores `undefined`.
* `server/repositories/referenceSeedData.ts`: 60 ambientes canônicos do Campus BSF e dados da equipe CGAO.

### 3.4. Interface e Páginas Frontend
* `src/pages/admin/AdminOccurrencesPage.tsx`: Aba "Minhas Ocorrências" e escopo visual para Atendente.
* `src/pages/admin/AdminOccurrenceDetailPage.tsx`: Ações restritas para Atendente e visualização condicionada de notas.
* `src/pages/admin/AdminTeamsPage.tsx`: Interface para gestão de e-mails de equipe e equipe inicial de acolhimento.
* `src/pages/NewOccurrencePage.tsx`: Catálogo público consumindo exclusivamente locais e blocos ativos.
