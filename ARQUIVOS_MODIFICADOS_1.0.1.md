# Arquivos Modificados — Versão 1.0.1

## Código e configuração

- `.github/workflows/validate-pull-request.yml` — novo pipeline de validação e empacotamento.
- `README.md` — documentação funcional da 1.0.1.
- `CHANGELOG.md` — changelog da 1.0.1.
- `package.json`, `package-lock.json`, `src/config/version.ts` — identidade 1.0.1.
- `metadata.json`, `firebase-blueprint.json`, `cloudbuild.yaml` — identidade e modelo de release.
- `infra/cloudflare/maintenance-worker/package.json`, `package-lock.json`, `src/index.ts` — identidade do Worker.
- `scripts/verifyRelease.mjs`, `scripts/deployCloudRun.sh` — verificação e guardas da release.
- `src/models/occurrence.ts` — contratos de classificação, apensamento, grupo e atualização.
- `src/models/admin.ts` — eventos de auditoria.
- `server/models/occurrenceDomain.ts` — persistência dos metadados de apensamento.
- `server/repositories/occurrenceRepository.ts` — leitura/escrita, agrupamento e sincronização transacional.
- `server/services/occurrenceService.ts` — regras de negócio, permissões, histórico e propagação.
- `server/services/operationalAdminService.ts` — exclusão de TEST das métricas/relatórios padrão e proteção de expurgo.
- `server/serializers/occurrenceDto.ts` — serialização administrativa e títulos de histórico.
- `server/validators/schemas.ts`, `src/validators/responses.ts` — contratos de entrada e saída.
- `src/pages/admin/AdminOccurrenceDetailPage.tsx` — controles REAL/TEST e apensamento.
- `src/pages/admin/AdminOccurrencesPage.tsx` — badges TEST/APENSADA e nomenclatura do filtro.
- `tests/helpers/fakeRepositories.ts` — suporte de testes à propagação.
- `tests/occurrenceService.test.ts` — testes funcionais 1.0.1.
- `tests/maintenanceWorker070.test.ts`, `tests/preDeployment071.test.ts`, `tests/scaleConfigGuard.test.ts` — alinhamento de identidade/guardas 1.0.1.

## Documentos novos da entrega

- `RELEASE_NOTES_1.0.1.md`
- `RELATORIO_IMPLEMENTACAO_1.0.1.md`
- `TESTES_1.0.1.md`
- `INSTRUCOES_INSTALACAO_IMPLANTACAO_1.0.1.md`
- `PENDENCIAS_1.0.1.md`
- `ARQUIVOS_MODIFICADOS_1.0.1.md`

Nenhum arquivo funcional preexistente foi removido.
