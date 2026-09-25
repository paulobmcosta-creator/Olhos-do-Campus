# Testes Executados — Versão 1.0.2

**Data:** 25 de setembro de 2026  
**Pipeline de referência:** GitHub Actions — `Validate pull request`  
**Run funcional validado:** #26 — commit `afd6eabb99b8a2b0ed3df333f76b13d2d7f0310f`

## Resultado

| Etapa | Resultado |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS |
| `npm run build` | PASS |
| `npm run verify:release` | PASS |
| `npm run check:scale` | PASS |
| `npm run worker:typecheck` | PASS |
| `npm run worker:test` | PASS |
| empacotamento integral da árvore | PASS |
| upload do artefato `olhos-do-campus-1.0.2-source` | PASS |

### Vitest principal
- 72 arquivos aprovados;
- 2 arquivos ignorados;
- 577 testes aprovados;
- 3 testes ignorados;
- 0 falhas;
- 580 testes contabilizados no total.

### Maintenance Worker
- 1 arquivo aprovado;
- 7 testes aprovados;
- 0 falhas.

### Build e verificações formais
- build de produção: PASS;
- `RELEASE_IDENTITY_TEST=PASS`;
- `MAX_SCALE_1_SECURITY_INVARIANT=YES`;
- `SCALE_OUT_ALLOWED=NO`;
- imagem canônica de release: `olhos-do-campus-api:v1.0.2`.

## Cobertura específica 1.0.2

A suíte valida:
- transição direta entre quaisquer situações operacionais ativas;
- situação livre para Administrador, Gestor e Atendente, preservando o escopo de autorização do Atendente;
- resolução direta a partir de `Recebida`;
- reabertura direta de situação final para qualquer situação não final;
- preservação do instante de encerramento em transição final → final;
- pausa e retomada coerentes do SLA em transições diretas;
- retirada de `Duplicada` das situações ativas;
- rejeição de `Duplicada` como novo destino operacional;
- compatibilidade de leitura com registros históricos em `Duplicada`;
- apensamento como mecanismo de duplicidade/similaridade e sincronização de situação entre membros;
- seletor administrativo sem `Duplicada` para registros correntes;
- identidade integral da versão 1.0.2;
- alinhamento do wrapper Cloud Run com a imagem `olhos-do-campus-api`.

## Testes não executados neste pipeline

Não foram executados:
- `npm run test:rules`;
- `npm run test:firebase`;
- `npm run test:storage`;
- integrações reais opt-in com EWS, R2 ou Resend.

Essas suítes exigem emuladores, Java ou credenciais/infraestrutura externa específica. Nenhum resultado foi inferido para elas.

## Histórico de correções durante a validação

Runs intermediários detectaram e bloquearam:
- incompatibilidades de TypeScript na tipagem inicial da matriz livre;
- dois erros de lint;
- testes antigos que ainda esperavam restrições de situação do Atendente;
- uma expectativa residual de versão 1.0.1 no teste pré-deploy.

Todos esses pontos foram corrigidos antes do run funcional #26.
