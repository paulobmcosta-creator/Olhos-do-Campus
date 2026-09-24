# Instruções de Instalação e Implantação — Versão 1.0.1

## Pré-requisitos

- Node.js `>=22.22.2 <23`;
- npm `>=10`;
- credenciais e variáveis de ambiente conforme a infraestrutura institucional existente;
- Java/Firebase CLI somente para suítes de emuladores.

## Instalação e validação

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify:release
npm run check:scale
npm run worker:typecheck
npm run worker:test
```

Para validação com Firebase Emulator, quando o ambiente estiver configurado:

```bash
npm run test:rules
npm run test:firebase
npm run test:storage
```

## Implantação

A versão 1.0.1 mantém a arquitetura produtiva existente. Não há migração obrigatória do Firestore.

O backend deve ser implantado antes ou em conjunto com o frontend, pois a interface administrativa 1.0.1 envia os novos campos de classificação e apensamento para a API.

O wrapper canônico do Cloud Run utiliza a tag `v1.0.1` e exige, para execução real:

```bash
ALLOW_CLOUD_RUN_DEPLOY=CONFIRM_DEPLOY_1_0_1 bash scripts/deployCloudRun.sh --apply
```

Sem esse token, o procedimento permanece protegido contra implantação acidental.

Após implantação, recomenda-se smoke test administrativo com:
1. criação de duas ocorrências controladas;
2. marcação de ambas como TEST;
3. apensamento de uma à outra;
4. alteração de situação e verificação da sincronização;
5. desapensamento;
6. conversão de TEST para REAL ou exclusão administrativa dos registros controlados, conforme a finalidade do teste.

Nenhuma implantação em produção é realizada automaticamente pelo pull request de desenvolvimento.
