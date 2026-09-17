# Relatório de implementação — versão 0.7.5

## 1. Fonte de verdade

A 0.7.5 foi consolidada exclusivamente a partir de `olhos-do-campus-0.7.4-pos-homologacao.zip`, recebido após a validação no Google Cloud Shell. O artefato de entrada contém 371 arquivos e SHA-256 `c0c43f7a53f075a126fffc974639b1f5c7b8a893774c892cba1340ef6374d77c`.

Nenhum arquivo de versão anterior foi usado para substituir conteúdo dessa árvore.

## 2. Objetivo

Formalizar em uma versão distribuível as correções descobertas durante a homologação da 0.7.4 e a adaptação do manifesto de índices ao Firestore Enterprise do ambiente real.

Não há redesign funcional, mudança de arquitetura, novo serviço externo ou alteração de modelo de domínio nesta versão.

## 3. Correções já presentes na fonte pós-homologação

A árvore recebida já incorporava:

- contrato HTTP com `WEBHOOK_ATTEMPT_ID_INVALID` e `WEBHOOK_ATTEMPT_WITHOUT_NOTIFICATION`;
- parser do cliente sincronizado com esses códigos;
- correção de `legacyDirectConflict` no repositório Firestore e no in-memory;
- teste WebP sem dependência de `instanceof Blob` cross-realm;
- ajuste do teste `notificationTechnicalRetry074` para uso correto de `pending`;
- manifesto `firestore.indexes.json` sem `fieldOverrides` e com seis índices explícitos DENSE de collection group `attempts`.

Esses pontos foram preservados e documentados; não foram reescritos.

## 4. Alterações introduzidas pela 0.7.5

- versionamento raiz, metadata, blueprint e Maintenance Worker atualizado para `0.7.5`;
- health do Worker atualizado para `0.7.5`;
- testes de coerência de versão atualizados;
- novo `tests/firestoreEnterprise075.test.ts` para prevenir regressão do manifesto Enterprise;
- README e CHANGELOG atualizados;
- documentação específica de Firestore Enterprise, testes, homologação, arquivos e inspeção final criada.

## 5. Firestore Enterprise

O ambiente real é um banco Firestore Native Enterprise nomeado, em `us-west1`. O deploy de índices baseado em `fieldOverrides` foi rejeitado com HTTP 400. A solução preservada na árvore pós-homologação materializa os seis campos usados pela collection group `attempts` como índices explícitos DENSE.

As regras Firestore/Storage foram publicadas com sucesso. Os seis índices foram aceitos e observados em `CREATING`; não há evidência anexada ao fechamento de que todos já tenham chegado a `READY`.

## 6. Testes

A homologação principal da árvore pós-correções passou no Cloud Shell com Node 22.22.2:

- typecheck: PASSOU;
- lint: PASSOU;
- suíte principal: 298 testes aprovados, 2 opt-in ignorados;
- Worker: typecheck PASSOU e 4/4 testes;
- build cliente/servidor: PASSOU;
- `npm audit`: 0 vulnerabilidades;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- rules: 2/2;
- Firebase integration: 19/19;
- Storage integration: 6/6.

O novo teste 0.7.5 foi criado após essa bateria e deve ser executado no próximo ciclo de CI/Cloud Shell. Consulte `docs/TESTES_0.7.5.md`.

## 7. Segurança e preservação

Nenhum segredo foi inserido no projeto. `.env.example` mantém placeholders. Fotografias continuam privadas, processadas server-side e com arquitetura R2/Firebase fallback preservada. Firestore e Storage continuam deny-all para clientes Web. O sistema continua sem armazenar IP no documento da ocorrência e mantém separação entre mensagens públicas e observações internas.

## 8. Limitações e pendências

1. confirmar os seis índices `attempts` em `READY` antes do tráfego produtivo dependente deles;
2. executar o novo teste `firestoreEnterprise075.test.ts` em ambiente Node 22.22.2 com dependências instaladas;
3. homologar integrações externas opt-in de R2 e Resend no momento apropriado;
4. prosseguir para secrets, R2, Resend, Cloud Run, Pages e Worker somente após o gate dos índices.

## 9. Situação

**0.7.5 consolidada para continuação da implantação controlada.** O código funcional base está homologado; permanece um gate externo verificável de prontidão dos índices Enterprise e a execução do novo teste de regressão 0.7.5.
