# Inspeção do ZIP final — versão 0.7.5

Artefato previsto: `olhos-do-campus-0.7.5.zip`.

Fonte de verdade: `olhos-do-campus-0.7.4-pos-homologacao.zip`, 371 arquivos, SHA-256 `c0c43f7a53f075a126fffc974639b1f5c7b8a893774c892cba1340ef6374d77c`.

## Inspeção da árvore antes do empacotamento

- [x] raiz do projeto renomeada para `olhos-do-campus-0.7.5/`;
- [x] versionamento raiz em `0.7.5`;
- [x] versionamento do Maintenance Worker em `0.7.5`;
- [x] `APP_VERSION` em `0.7.5`;
- [x] metadata e blueprint em `0.7.5`;
- [x] 13 JSONs parseados sem erro;
- [x] 215 arquivos TS/TSX não declarativos transpilados sintaticamente sem erro;
- [x] `server/types/express.d.ts` parseado sem erro;
- [x] seis índices `attempts` explícitos, DENSE e `COLLECTION_GROUP`;
- [x] ausência de `fieldOverrides`;
- [x] nenhum `.env` real, backup, `.tmp` ou `.log` na árvore;
- [x] scan auxiliar sem padrões fortes de credenciais;
- [x] diff sem erro de whitespace.

## Testes funcionais

A bateria funcional completa não foi repetida no ambiente de empacotamento porque ele possui Node 22.16.0, abaixo da baseline `>=22.22.2 <23`, e o ZIP de entrada não contém `node_modules`.

A fonte pós-homologação havia passado no Cloud Shell, Node 22.22.2, por typecheck, lint, 298 testes principais, Worker, build, audits e Emulator Suite. A 0.7.5 altera apenas versionamento/documentação e acrescenta o teste de regressão Enterprise; esse novo teste deverá ser executado na próxima sessão compatível.

## Inspeção do contêiner ZIP

Uma primeira geração de conferência foi criada e reaberta antes do fechamento definitivo:

- [x] `unzip -t` sem erros;
- [x] 378 arquivos no contêiner;
- [x] raiz única `olhos-do-campus-0.7.5/`;
- [x] nenhum `node_modules`;
- [x] nenhum `dist`;
- [x] nenhum `.git`;
- [x] nenhum `.env` real;
- [x] nenhum `.log`, `.bak` ou `.tmp`.

Após registrar esta inspeção, o ZIP é regenerado uma última vez e reaberto novamente. O SHA-256 definitivo não é inserido dentro do próprio ZIP para evitar auto-referência. Ele é entregue em arquivo sidecar `olhos-do-campus-0.7.5.zip.sha256` e na devolutiva.
