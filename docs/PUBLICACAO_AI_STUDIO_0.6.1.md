# Publicação no Google AI Studio — 0.6.1

## Contexto

A 0.6.1 corrige o empacotamento que anteriormente produzia um `build_artifacts.tar.gz` truncado próximo de 250 MB, majoritariamente composto por `node_modules` de desenvolvimento.

## Fluxo recomendado

1. Importar/substituir o código pelo ZIP integral 0.6.1.
2. Não alterar o script `build` nem remover `scripts/prepareProductionPackage.mjs`.
3. Executar o Preview.
4. Confirmar `/api/health` com versão 0.6.1.
5. Executar Publish uma única vez.
6. No Cloud Run, confirmar que foi criada nova revisão com nome automático.
7. Confirmar que `latestCreatedRevisionName` e `latestReadyRevisionName` convergem após o deploy.

## Verificação do artefato caso haja nova falha

Localizar a URI da anotação `run.googleapis.com/sources`, baixar o `build_artifacts.tar.gz` e executar:

```bash
gzip -t build_artifacts.tar.gz
tar -tzf build_artifacts.tar.gz >/tmp/odc-tar-list.txt
```

O pacote deve estar íntegro e não deve carregar o conjunto de ferramentas de desenvolvimento que motivou o hotfix.

## Revisões Cloud Run

O serviço já deve permanecer com geração automática de nomes de revisão. Não fixar novamente um nome como `olhos-do-campus-051-direct` no template.

## Segurança operacional

Não incluir `.env`, credenciais, chaves ou tokens no ZIP. Chaves eventualmente expostas em logs ou conversas devem ser rotacionadas no provedor correspondente.
