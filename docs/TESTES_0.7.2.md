# Testes — versão 0.7.2

Data da execução: 2026-08-18/19 (UTC no sandbox).

## Ambiente

```text
node --version -> v22.16.0
npm --version  -> 10.9.2
java -version  -> OpenJDK 21.0.11
```

Baseline do projeto preservada:

```text
Node >=22.22.2 <23
npm >=10
```

Classificação principal:

**BLOQUEADO PELO AMBIENTE — versão local do Node abaixo da baseline exigida.**

A tentativa segura de obter Node 22.22.2 com `npx -y node@22.22.2 --version` expirou. O acesso direto do container a `nodejs.org` também não resolveu DNS.

## Instalação limpa

`npm ci --no-audit --no-fund` foi efetivamente invocado. A execução não concluiu dentro da janela disponível e reportou `EBADENGINE` para:

- `olhos-do-campus@0.7.2` — exige `>=22.22.2 <23`;
- `jsdom@30.0.1` — exige `^22.22.2 || ^24.15.0 || >=26.0.0`;
- `undici@8.10.0` — exige `>=22.19.0`.

Uma tentativa adicional `npm ci --offline --no-audit --no-fund` falhou com:

```text
ENOTCACHED
zod-validation-error-4.0.2.tgz não estava disponível no cache local
```

Nenhuma árvore parcial de `node_modules` foi mantida no projeto final.

## Comandos obrigatórios

| Comando | Resultado |
|---|---|
| `node --version` | EXECUTADO — `v22.16.0`; abaixo da baseline |
| `npm --version` | EXECUTADO — `10.9.2` |
| `npm ci` | BLOQUEADO PELO AMBIENTE — runtime incompatível; instalação não concluiu |
| `npm run typecheck` | BLOQUEADO — `TS2688` para `@testing-library/jest-dom`, `node` e `vite/client`, não materializados por `npm ci` |
| `npm run lint` | BLOQUEADO — runner `eslint` indisponível/inexecutável após instalação incompleta |
| `npm run test` | BLOQUEADO — runner `vitest` indisponível/inexecutável |
| `npm run worker:typecheck` | BLOQUEADO — `TS2688` para `@cloudflare/workers-types` |
| `npm run worker:test` | BLOQUEADO — runner `vitest` indisponível/inexecutável |
| `npm run build` | BLOQUEADO — `vite` indisponível/inexecutável |
| `npm audit` | BLOQUEADO — `getaddrinfo EAI_AGAIN registry.npmjs.org` |
| `npm audit --omit=dev` | BLOQUEADO — `getaddrinfo EAI_AGAIN registry.npmjs.org` |
| `npm run test:rules` | BLOQUEADO — Firebase CLI não disponível porque `npm ci` não concluiu |
| `npm run test:firebase` | BLOQUEADO — Firebase CLI não disponível porque `npm ci` não concluiu |
| `npm run test:storage` | BLOQUEADO — Firebase CLI não disponível porque `npm ci` não concluiu |

Java/JRE está presente; nesta execução, portanto, o bloqueio do Emulator Suite não é Java, e sim a ausência da instalação npm/Firebase CLI íntegra.

## Testes externos opt-in

`test:r2` e `test:resend` foram preservados como opt-in. Nenhuma chamada real ao R2, migração real ou envio real de e-mail foi realizado. Sem instalação íntegra do Vitest e sem credenciais explicitamente autorizadas, essas integrações não foram executadas.

## Validações auxiliares efetivamente executadas

Como a suíte oficial ficou bloqueada, foram executadas verificações estáticas e funcionais independentes que não substituem Vitest/typecheck:

- transpilação sintática via TypeScript 5.8.3 global: **212 arquivos TS/TSX, zero diagnósticos sintáticos**;
- parse de `firestore.indexes.json` e `firebase-blueprint.json`: **PASSOU**;
- validação estrutural de versão, baseline Node, tag Resend, parser, estados unmatched e integração da manutenção: **PASSOU**;
- confirmação de que `infra/artifact-registry-cleanup-policy.json`, `cloudbuild.yaml`, `Dockerfile`, `firestore.rules` e `r2PhotoRepository.ts` permanecem idênticos à 0.7.1: **PASSOU**;
- comparação de lockfiles: **zero mudanças de versão de dependências**;
- execução funcional isolada da implementação in-memory, com stub mínimo apenas para o módulo Firebase importado: corrida webhook/lease, reconciliação unmatched, privacidade da razão persistida e conflito de correlação: **PASSOU**;
- execução isolada do provider Resend com stub do SDK: transformação `notificationId -> notification_id` e rejeição de ID inválido: **PASSOU**;
- `git diff --no-index --check`: nenhuma mensagem de erro de whitespace foi produzida.

## Cobertura adicionada

Novo arquivo `tests/notificationCorrelation072.test.ts`, com cenários para:

- ID lógico recebido pelo provider;
- tag `notification_id` e ausência de PII;
- tag inválida;
- correlação por tag antes do `providerMessageId`;
- fallback legado por `providerMessageId`;
- tag inexistente com fallback compatível;
- conflito entre evidências;
- `UNMATCHED_PENDING`;
- razão técnica sanitizada;
- reconciliação para `PROCESSED`;
- replay/deduplicação;
- expiração controlada;
- webhook antes de `markSent`;
- webhook antes de `markDeliveryUncertain`;
- resolução de `DELIVERY_UNCERTAIN`;
- consumo por `providerAcceptedAt`;
- índices Firestore;
- terminologia e observabilidade no painel;
- integração da reconciliação ao ciclo de manutenção.

A árvore passa de 46 para 47 arquivos `tests/*.test.ts`; os dois testes externos opt-in continuam preservados.

## Conclusão

Os cenários residuais receberam cobertura no código e em testes, mas a suíte oficial não pôde ser validada integralmente no ambiente desta conversa.

**Código corrigido; validação pré-implantação ainda pendente em ambiente compatível.**
