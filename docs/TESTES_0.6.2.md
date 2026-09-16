# Testes — 0.6.2

## Verificações executadas

- `node --check scripts/prepareProductionPackage.mjs`: aprovado.
- Parsing de `package.json`, `package-lock.json`, `metadata.json` e `firebase-blueprint.json`: aprovado.
- Coerência de versão: 0.6.2 em manifestos e `APP_VERSION`.
- Busca de hardcode ativo do contrato de bootstrap: o literal `0.6.0` foi removido do modelo e do schema de resposta.
- `tsc --noEmit --pretty false`: iniciado; não alcançou a checagem do projeto porque o ambiente não possui `node_modules`. Os únicos erros foram TS2688 para tipos externos ausentes (`@testing-library/jest-dom`, `node`, `vite/client`). Nenhum diagnóstico foi emitido para arquivos alterados.

## Teste de regressão criado

`tests/bootstrapContractVersion062.test.ts` valida que:

1. payload de bootstrap com `runtime.version = APP_VERSION` é aceito;
2. uma versão divergente é rejeitada.

## Testes não executados neste ambiente

A suíte Vitest, lint e build completo dependem da instalação das dependências. O ZIP não contém `node_modules`, por desenho de segurança e distribuição. Executar no AI Studio/CI após instalação normal:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

No Preview, o critério funcional principal é que a tela inicial deixe de apresentar a mensagem de contrato incompatível e `/api/config` seja consumido normalmente.
