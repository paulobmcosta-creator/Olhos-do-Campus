# Arquivos da versão 0.7.5

Comparação por SHA-256 entre a fonte de verdade `olhos-do-campus-0.7.4-pos-homologacao.zip` e a árvore 0.7.5 antes do fechamento do ZIP, excluindo artefatos que não pertencem ao projeto.

## Criados

- `docs/ARQUIVOS_0.7.5.md`
- `docs/FIRESTORE_ENTERPRISE_0.7.5.md`
- `docs/HOMOLOGACAO_MANUAL_0.7.5.md`
- `docs/INSPECAO_ZIP_FINAL_0.7.5.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.7.5.md`
- `docs/TESTES_0.7.5.md`
- `tests/firestoreEnterprise075.test.ts`

## Modificados

- `CHANGELOG.md`
- `README.md`
- `firebase-blueprint.json`
- `infra/cloudflare/maintenance-worker/package-lock.json`
- `infra/cloudflare/maintenance-worker/package.json`
- `infra/cloudflare/maintenance-worker/src/index.ts`
- `metadata.json`
- `package-lock.json`
- `package.json`
- `src/config/version.ts`
- `tests/bootstrapContractVersion062.test.ts`
- `tests/preDeployment071.test.ts`

## Removidos

Nenhum arquivo.

## Preservados da fonte pós-homologação

A correção real do manifesto Enterprise já estava presente na fonte de verdade recebida e, por isso, `firestore.indexes.json` não aparece como modificado pela consolidação 0.7.5. O mesmo vale para as correções pós-homologação em:

- `src/models/http.ts`;
- `src/services/apiClient.ts`;
- `server/repositories/notificationOutboxRepository.ts`;
- `tests/apiClient.test.ts`;
- `tests/notificationTechnicalRetry074.test.ts`.

Esses arquivos foram inspecionados e preservados como recebidos.

## Dependências

Nenhuma dependência, devDependency ou engine foi alterada. Os `package-lock.json` mudaram somente no versionamento do pacote raiz/Worker.
