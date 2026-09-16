# Relatório de Implementação — 0.6.2

**Projeto:** Olhos do Campus  
**Versão:** 0.6.2  
**Base:** 0.6.1 integral recebida no ZIP correto  

## Diagnóstico

No Preview, o backend inicializava normalmente na porta 3000 e `/api/config` retornava `runtime.version` a partir de `APP_VERSION`, já em `0.6.1`. O frontend, entretanto, mantinha dois contratos ativos fixados em `0.6.0`:

- `src/models/config.ts` — `RuntimeInfo.version`;
- `src/validators/responses.ts` — `bootstrapResponseSchema`.

Isso fazia `requestJson()` rejeitar uma resposta HTTP 200 válida com a mensagem “O serviço retornou dados incompatíveis com o contrato esperado.”

## Implementação

1. `RuntimeInfo.version` passou a usar `typeof APP_VERSION`.
2. `bootstrapResponseSchema` passou a validar `z.literal(APP_VERSION)`.
3. A página inicial passou a exibir `APP_VERSION` dinamicamente.
4. A geração de nova `policyVersion` de SLA passou a usar `APP_VERSION`.
5. O teste estático de coerência de versão passou a comparar `package.json`, `metadata.json` e `firebase-blueprint.json` com `APP_VERSION`.
6. A fixture de bootstrap das rotas passou a usar `APP_VERSION`.
7. Foi criado teste de regressão específico do contrato de bootstrap.
8. Versionamento ativo atualizado para 0.6.2.

## Escopo preservado

Não houve alteração em domínio persistido, endpoints, regras de autorização, Firebase Auth, App Check, Firestore Rules, Storage Rules, repositórios, controllers, dados de referência, migração 0.6.0 ou política histórica de SLA. A preparação de pacote de produção implementada na 0.6.1 permanece inalterada.
