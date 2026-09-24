# Testes Executados — Versão 1.0.1

**Data:** 24 de setembro de 2026  
**Pipeline de referência:** GitHub Actions — `Validate pull request`  
**Run validado:** #10 — commit `b900513ceae712d490919b0545aebcfaad7b7093`

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

### Vitest principal
- 72 arquivos aprovados;
- 2 arquivos ignorados;
- 578 testes aprovados;
- 3 testes ignorados;
- 0 falhas.

### Maintenance Worker
- 1 arquivo aprovado;
- 7 testes aprovados;
- 0 falhas.

### Verificações formais
- `RELEASE_IDENTITY_TEST=PASS`;
- `MAX_SCALE_1_SECURITY_INVARIANT=YES`;
- build Vite concluído com sucesso.

## Cobertura específica 1.0.1

Foram adicionados testes para:
- Gestor marcar ocorrência como TEST;
- Administrador converter TEST para REAL;
- exclusão de TEST do dashboard;
- apensamento de duas ocorrências;
- sincronização de situação;
- sincronização de prioridade;
- publicação de mensagem em todo o agrupamento;
- desapensamento;
- independência operacional após desapensamento;
- rejeição de agrupamento misto REAL/TEST.

## Testes não executados neste pipeline

Não foram executados nesta validação:
- `npm run test:rules`;
- `npm run test:firebase`;
- `npm run test:storage`;
- testes opt-in com EWS, R2 ou Resend reais.

Essas suítes exigem emuladores, credenciais ou infraestrutura externa específica. Nenhum resultado foi inferido para elas.
