# Testes — versão 0.7.4

Data: 2026-08-19. Fonte de verdade: ZIP 0.7.3. Nenhum deploy, envio Resend real ou migração externa foi executado.

## Ambiente

| Comando | Resultado |
|---|---|
| `node --version` | EXECUTADO — `v22.16.0` |
| `npm --version` | EXECUTADO — `10.9.2` |
| `java -version` | EXECUTADO — OpenJDK `21.0.11` |

Baseline do projeto: Node `>=22.22.2 <23`.

**BLOQUEADO PELO AMBIENTE — versão de Node inferior à baseline do projeto.**

Foi tentada obtenção isolada de Node 22.22.2 sem alterar o projeto, mas o host não resolveu `nodejs.org`. A baseline não foi rebaixada.

## Comandos obrigatórios

| Comando | Resultado real |
|---|---|
| `npm ci` | BLOQUEADO — `EBADENGINE` para o projeto/jsdom/undici; terminou com erro interno do npm `Exit handler never called!` |
| `npm run typecheck` | BLOQUEADO — TS2688: tipos `@testing-library/jest-dom`, `node` e `vite/client` não materializados |
| `npm run lint` | BLOQUEADO — `eslint: not found` |
| `npm run test` | BLOQUEADO — `vitest: not found` |
| `npm run worker:typecheck` | BLOQUEADO — tipo `@cloudflare/workers-types` não materializado |
| `npm run worker:test` | BLOQUEADO — `vitest: not found` |
| `npm run build` | BLOQUEADO — `vite: not found` |
| `npm audit` | BLOQUEADO — `getaddrinfo EAI_AGAIN registry.npmjs.org`; audit endpoint indisponível |
| `npm audit --omit=dev` | BLOQUEADO — mesmo `EAI_AGAIN` |
| `npm run test:rules` | BLOQUEADO — `firebase: not found` |
| `npm run test:firebase` | BLOQUEADO — `firebase: not found` |
| `npm run test:storage` | BLOQUEADO — `firebase: not found` |

Diagnóstico complementar `npm ci --offline --no-audit --no-fund`: falhou com `ENOTCACHED` para `zod-validation-error-4.0.2.tgz`, além dos avisos `EBADENGINE`.

O Java está disponível; os testes de Emulator Suite ficaram bloqueados porque a instalação npm/Firebase CLI não foi materializada.

## Validações auxiliares realmente executadas

Estas verificações não substituem typecheck, Vitest, build ou audit:

- transpilação sintática com TypeScript global 5.8.3: **214 arquivos TS/TSX, zero erros sintáticos**;
- parse dos 13 JSONs do projeto: **PASSOU**;
- parse de `cloudbuild.yaml`: **PASSOU**;
- comparação de dependências/devDependencies/overrides: **nenhuma alteração**;
- comparação byte a byte de R2, fallback Storage, migração/reconciliação, Artifact Registry, Cloud Build, Docker, Pages, Firestore indexes/rules e lógica HMAC/cron do Worker: **PASSOU**;
- `git diff --no-index --check`: saída vazia, sem erro de whitespace reportado;
- execução auxiliar do núcleo `InMemoryNotificationOutboxRepository` e da classificação Resend, com stubs apenas para dependências externas: **PASSOU** nos invariantes de retry técnico.

### Cenários auxiliares aprovados

- `concurrent_idempotent_requests` → `SAME_ATTEMPT` + janela de idempotência;
- HTTP 500 estruturado → `SAME_ATTEMPT`;
- 429/rate limit → `SAME_ATTEMPT` + provider rejected;
- A1/K1 é reutilizada após backoff;
- `attemptCount` permanece 1 no retry técnico;
- `technicalRetryCount` incrementa separadamente;
- dois claims concorrentes concedem uma única lease;
- falha confirmada `NEW_ATTEMPT` encerra A1 e cria A2/K2;
- webhook `DELIVERED` durante o backoff encerra A1 e impede retry posterior;
- consumo de A1 permanece uma unidade;
- exceder o limite de retry técnico leva a `DELIVERY_UNCERTAIN` sem criar A2.

## Cobertura adicionada

Foi criado `tests/notificationTechnicalRetry074.test.ts`, com 8 testes adicionais para:

1. taxonomia de `concurrent_idempotent_requests`, 5xx e quota;
2. same-attempt retry e concorrência de lease;
3. 500 ambíguo e timeout de transporte;
4. falha confirmada que autoriza A2/K2;
5. `technicalRetryCount` e limite seguro;
6. webhook durante backoff;
7. consumo após duas chamadas técnicas A1/K1;
8. rate limit/quota sem inflação de attempts.

A árvore contém 49 arquivos `tests/*.test.ts`; os 2 testes externos opt-in permanecem preservados.

## Integrações externas não executadas

- `npm run test:resend`: não executado; não foi autorizado envio real e a suíte normal está sem dependências;
- `npm run test:r2`: não executado; R2 está fora do escopo da 0.7.4;
- Resend real, Cloud Run, Cloudflare Worker, Firebase real e Artifact Registry: não executados.

## Conclusão

O código passou pelas validações auxiliares disponíveis, mas a bateria oficial não foi executada até o fim. A 0.7.4 não deve ser declarada pronta para implantação até repetir os comandos obrigatórios em Node 22.22.2+ com registry npm acessível.
