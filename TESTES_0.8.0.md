# RELATÓRIO DE TESTES E HOMOLOGAÇÃO — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## 1. Resumo Consolidado das Suítes de Teste

| Categoria | Comando | Arquivos | Testes | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Typecheck** | `npm run typecheck` | - | - | **PASS (0 erros)** |
| **Linter** | `npm run lint` | - | - | **PASS (0 erros, 0 warnings)** |
| **Suíte Principal (Vitest)** | `npm run test` | 61 | 425 | **PASS (425 aprovados, 3 skipped)** |
| **Build de Produção** | `npm run build` | - | - | **PASS (SPA + Server Bundle)** |
| **Validação Integrada** | `npm run validate` | - | - | **PASS (Exit code 0)** |
| **Worker Typecheck** | `npm run worker:typecheck` | - | - | **PASS (0 erros)** |
| **Worker Testes** | `npm run worker:test` | 1 | 4 | **PASS (4 aprovados)** |
| **Firebase Rules** | `npm run test:rules` | 1 | 2 | **PASS (2 aprovados)** |
| **Firebase Integration (Emulator)** | `npm run test:firebase` | 1 | 19 | **PASS (19 aprovados)** |
| **Storage Integration (Emulator)** | `npm run test:storage` | 1 | 6 | **PASS (6 aprovados)** |
| **TOTAL COMPROVADO** | - | **65** | **456** | **100% APROVADO** |

---

## 2. Testes Dirigidos da Versão 0.8.0

1. **RBAC de Atendente (`tests/attendantRole080.test.ts` - 7 testes)**:
   - Visibilidade restrita de listagem e contagem por `assignedToAdminUserId`.
   - Execução das 7 transições autorizadas de status.
   - Bloqueio de transições não autorizadas com 403 `FORBIDDEN`.
   - Isolamento de notas internas com audiência `RESPONSIBLE_TEAM`.
   - Bloqueio de mutações estruturais (categoria, prioridade, local, setor, responsável, duplicidade, reabertura, cancelamento).
   - Bloqueio de publicação e exclusão de fotos de solução.

2. **Gestão de Locais e Ambientes (`tests/locationManagement080.test.ts` - 4 testes)**:
   - Omissão de locais inativos no catálogo público (`listActiveForPublic()`).
   - Omissão de blocos sem ambientes ativos no bootstrap público.
   - Reativação de blocos e ambientes desativados por Administrador.
   - Bloqueio de exclusão física com 409 `CONFLICT` para locais já utilizados em ocorrências.

3. **Equipes e Notificações (`tests/teamRoutingNotifications080.test.ts` - 7 testes)**:
   - Encaminhamento automático de novas ocorrências para `team-cgao` com outbox para `cgao.bsf@ifes.edu.br`.
   - Roteamento setorial gerando `OCCURRENCE_TEAM_ROUTED`.
   - Atribuição individual gerando `OCCURRENCE_RESPONSIBLE_ASSIGNED`.
   - Validação de invariantes no `OperationalAdminService`.
   - Regressão GD-F001: omissão de `teamName` quando `assignedTeamNameSnapshot === undefined`.
   - Preservação de `teamName` quando `assignedTeamNameSnapshot` está presente.
   - Idempotência de outbox e diferenciação de reatribuições sucessivas.

4. **Migração 0.8.0 (`tests/migrate080.test.ts` - 10 testes)**:
   - Criação e reconciliação da equipe CGAO.
   - Desmarcação de equipes concorrentes como inicial.
   - Idempotência em múltiplas execuções de plano.
   - Não ativação automática de atendentes legados.

5. **Limpeza de Ambientes Artificiais (`tests/cleanupArtificialLocations.test.ts` - 7 testes)**:
   - Execução segura baseada em allowlist vazia por padrão (`ARTIFICIAL_LOCATION_TARGETS = []`).
   - Preservação integral de novos ambientes legítimos criados por administradores fora dos 60 canônicos.
   - Validação de planos em `--dry-run`.

---

## 3. Integrações Opt-in com Serviços Reais

* `tests/ewsIntegration.optIn.test.ts`: **NOT RUN — OPT-IN** (requer credenciais institucionais EWS de homologação).
* `tests/r2Integration.optIn.test.ts`: **NOT RUN — OPT-IN** (requer bucket e tokens reais do Cloudflare R2).
* `tests/resendIntegration.optIn.test.ts`: **NOT RUN — OPT-IN** (requer API Key ativa do Resend).

Esses testes são reservados para validação pré-deploy em ambiente controlado com credenciais ativas e não impactam a homologação técnica da versão 0.8.0.
