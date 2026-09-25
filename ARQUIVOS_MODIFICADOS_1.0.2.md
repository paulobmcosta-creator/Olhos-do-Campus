# Arquivos Modificados — Versão 1.0.2

## Domínio e regras operacionais

- `src/models/occurrence.ts` — separação entre situações ativas e situação legada `Duplicada`.
- `server/domain/occurrenceStateMachine.ts` — transições livres e reabertura generalizada.
- `server/services/occurrenceService.ts` — efeitos de mudança de situação, reabertura, SLA e retirada da criação de duplicidade legada.
- `server/validators/schemas.ts` — atualização aceita apenas situações ativas; filtros mantêm compatibilidade histórica.
- `src/validators/responses.ts` — respostas aceitam valores históricos persistidos.
- `src/pages/admin/AdminOccurrenceDetailPage.tsx` — seletor livre e retirada de `Duplicada`.
- `firebase-blueprint.json` — documentação do contrato 1.0.2.

## Testes

- `tests/occurrenceStateMachine.test.ts`
- `tests/occurrenceDomainRules.test.ts`
- `tests/transitionConcurrencyG3.test.tsx`
- `tests/firebaseIntegration.test.ts`
- `tests/preDeployment071.test.ts`
- `tests/maintenanceWorker070.test.ts`
- `tests/scaleConfigGuard.test.ts`

## Identidade e implantação

- `package.json`, `package-lock.json`
- `src/config/version.ts`
- `metadata.json`
- `cloudbuild.yaml`
- `infra/cloudflare/maintenance-worker/package.json`
- `infra/cloudflare/maintenance-worker/package-lock.json`
- `infra/cloudflare/maintenance-worker/src/index.ts`
- `scripts/verifyRelease.mjs`
- `scripts/deployCloudRun.sh`
- `.github/workflows/validate-pull-request.yml`
- `README.md`
- `CHANGELOG.md`

## Documentos novos da entrega

- `RELEASE_NOTES_1.0.2.md`
- `RELATORIO_IMPLEMENTACAO_1.0.2.md`
- `TESTES_1.0.2.md`
- `INSTRUCOES_INSTALACAO_IMPLANTACAO_1.0.2.md`
- `PENDENCIAS_1.0.2.md`
- `ARQUIVOS_MODIFICADOS_1.0.2.md`

Nenhum arquivo funcional preexistente foi removido.
