# Mapeamento e Catálogo de Arquivos — Versão 0.7.7

## 1. Finalidade

A versão 0.7.7 é uma correção de transporte do provedor EWS/NTLM decorrente do bloqueio operacional da candidata 0.7.6. A arquitetura, os modelos de dados, a autenticação, o armazenamento R2, o App Check, o Firestore e a semântica transacional da outbox foram preservados.

## 2. Arquivos funcionalmente modificados

| Arquivo | Alteração |
| --- | --- |
| `server/providers/ews/ntlmClient.ts` | Passa a construir os headers da requisição NTLM Type 3 com `Content-Length` canônico em bytes; remove `Transfer-Encoding` e `Content-Length` externos conflitantes antes do envio autenticado. |
| `tests/ntlmHttpFraming077.test.ts` | Nova cobertura regressiva para framing HTTP do Type 3, incluindo UTF-8, `Buffer`, comprimento externo incorreto, `Transfer-Encoding` e ausência de corpo. |
| `tests/ewsIntegration.optIn.test.ts` | Atualiza o identificador textual da integração real para a candidata 0.7.7. |

## 3. Arquivos de versionamento e release modificados

- `package.json`
- `package-lock.json`
- `metadata.json`
- `firebase-blueprint.json`
- `src/config/version.ts`
- `cloudbuild.yaml`
- `infra/cloudflare/maintenance-worker/package.json`
- `infra/cloudflare/maintenance-worker/package-lock.json`
- `infra/cloudflare/maintenance-worker/src/index.ts`
- `tests/preDeployment071.test.ts`
- `scripts/preMigrationResendCheck.ts`
- `README.md`
- `CHANGELOG.md`

## 4. Documentação criada para 0.7.7

- `RELATORIO_IMPLEMENTACAO_0.7.7.md`
- `TESTES_0.7.7.md`
- `INSPECAO_ZIP_FINAL_0.7.7.md`
- `docs/ARQUIVOS_0.7.7.md`
- `docs/EWS_CONFIGURACAO_0.7.7.md`
- `docs/HOMOLOGACAO_MANUAL_0.7.7.md`
- `docs/IMPLANTACAO_0.7.7.md`

## 5. Arquivos históricos preservados

Os documentos 0.7.6 permanecem no pacote sem reescrita para registrar a candidata cujo gate EWS real foi bloqueado. Eles não substituem a documentação ativa 0.7.7.
