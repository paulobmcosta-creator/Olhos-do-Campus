# Testes — versão 0.7.3

Data da execução: 2026-08-18/19 no sandbox desta conversa. Nenhum deploy, migração real, acesso R2 real ou envio Resend real foi realizado.

## Ambiente

```text
node --version = v22.16.0
npm --version  = 10.9.2
java -version = OpenJDK 21.0.11
baseline do projeto = Node >=22.22.2 <23
```

**BLOQUEADO PELO AMBIENTE — versão local do Node abaixo da baseline exigida.**

Foi tentado obter Node 22.22.2 de forma isolada por `npx -y node@22.22.2 --version`, sem alterar o projeto; a operação excedeu 25 segundos e foi encerrada. A baseline não foi rebaixada.

## Instalação limpa

`npm ci --no-audit --no-fund` foi efetivamente iniciado após remoção de `node_modules` e `dist`. O comando registrou `EBADENGINE` para o projeto, `jsdom@30.0.1` e `undici@8.10.0`, porque o runtime local é Node 22.16.0. A instalação não concluiu no prazo do sandbox e foi encerrada.

A tentativa offline produziu erro determinístico:

```text
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz failed:
cache mode is 'only-if-cached' but no cached response is available.
```

Os comandos `npm audit` e `npm audit --omit=dev` confirmaram indisponibilidade de resolução DNS para o registry:

```text
getaddrinfo EAI_AGAIN registry.npmjs.org
```

Nenhuma dependência foi alterada para contornar o ambiente.

## Comandos obrigatórios

| Comando | Resultado real |
|---|---|
| `node --version` | EXECUTADO — `v22.16.0`, abaixo da baseline |
| `npm --version` | EXECUTADO — `10.9.2` |
| `npm ci` | **BLOQUEADO PELO AMBIENTE** — `EBADENGINE`; instalação não concluiu; cache offline incompleto (`ENOTCACHED`) e registry indisponível |
| `npm run typecheck` | **BLOQUEADO PELO AMBIENTE** — TS2688: ausentes `@testing-library/jest-dom`, `node` e `vite/client` porque `npm ci` não materializou dependências |
| `npm run lint` | **BLOQUEADO PELO AMBIENTE** — `eslint: not found` |
| `npm run test` | **BLOQUEADO PELO AMBIENTE** — `vitest: not found` |
| `npm run worker:typecheck` | **BLOQUEADO PELO AMBIENTE** — TS2688: `@cloudflare/workers-types` ausente |
| `npm run worker:test` | **BLOQUEADO PELO AMBIENTE** — `vitest: not found` |
| `npm run build` | **BLOQUEADO PELO AMBIENTE** — `vite: not found` |
| `npm audit` | **BLOQUEADO PELO AMBIENTE** — `getaddrinfo EAI_AGAIN registry.npmjs.org` |
| `npm audit --omit=dev` | **BLOQUEADO PELO AMBIENTE** — mesmo erro DNS |
| `npm run test:rules` | **BLOQUEADO PELO AMBIENTE** — `firebase: not found` |
| `npm run test:firebase` | **BLOQUEADO PELO AMBIENTE** — `firebase: not found` |
| `npm run test:storage` | **BLOQUEADO PELO AMBIENTE** — `firebase: not found` |

Java está disponível; os testes de Emulator Suite não iniciaram porque o Firebase CLI não pôde ser instalado pela árvore npm incompleta, e não por ausência de JRE.

## Validações auxiliares efetivamente executadas

Estas validações são complementares e **não substituem** typecheck, Vitest, lint ou build oficiais:

1. Transpilação sintática com TypeScript global 5.8.3 de todos os `.ts/.tsx` não declarativos: **213 arquivos aprovados, zero diagnóstico sintático** na passagem final após versionamento e documentação.
2. Parse dos JSONs críticos, incluindo `firestore.indexes.json`: **PASSOU**.
3. Validação funcional isolada do repositório in-memory attempt-aware, com stubs apenas para o módulo `firebase-admin/firestore`: **PASSOU** para:
   - A1/P1 → retry → A2/P2;
   - A2 criada antes do envio;
   - A2/K2 diferentes de A1/K1;
   - webhook P2 rápido correlacionado à A2 enquanto a outbox ainda mantinha P1 como cache;
   - `markSent` tardio sem rebaixamento;
   - webhook tardio A1 atualizando A1 sem rebaixar `DELIVERED` global;
   - consumo de duas tentativas aceitas = 2;
   - replay sem incremento de consumo;
   - recuperação técnica reutilizando mesma tentativa/idempotency key;
   - compatibilidade lazy de aceite 0.7.2.
4. Validação isolada do provider Resend com stub do SDK: **PASSOU** para geração simultânea de `notification_id` e `attempt_id` e rejeição de ID inválido.
5. Estrutura da árvore de testes: **48 arquivos `tests/*.test.ts`**, dos quais 2 permanecem integrações externas opt-in.
6. Comparação por hash dos componentes fora do escopo: R2, fallback Storage, scripts de migração/reconciliação R2, Artifact Registry cleanup, `cloudbuild.yaml`, `Dockerfile` e arquivos Pages permaneceram byte a byte idênticos à 0.7.2.
7. Comparação dos manifests: nenhuma dependência ou versão de dependência foi alterada; somente a versão do projeto/Worker foi elevada para 0.7.3.
8. Varredura forte de secrets na árvore final: **zero credenciais compatíveis e nenhum `.env` real**.

## Cobertura nova 0.7.3

`tests/notificationAttempts073.test.ts` cobre, entre outros:

- tentativa criada antes da chamada ao provider;
- tags `notification_id + attempt_id` sem PII;
- A1 aceita como P1 e A2 criada com novo `attempt_id`/K2;
- webhook P2 antes de `markSent(P2)` sem falso conflito com P1;
- webhook tardio da A1 sem regressão do estado global;
- estabelecimento de `providerMessageId` ausente pela própria tentativa;
- conflito real por `providerMessageId` divergente dentro da mesma tentativa;
- fallback por `providerMessageId`;
- `attempt_id` inexistente e `attempt_id` pertencente a outra notificação;
- recuperação técnica da mesma tentativa e concorrência de claims;
- consumo por tentativa aceita e não por outbox;
- `email.failed` pré-aceite sem consumo;
- resultado externo incerto sem aceite presumido;
- compatibilidade de outbox/webhook 0.7.2;
- materialização lazy da última tentativa histórica aceita de documento 0.7.2 antes de novo retry.

## Integrações externas

Não executadas por desenho desta etapa:

- `npm run test:resend`: envio real não autorizado/configurado;
- `npm run test:r2`: R2 real não utilizado;
- webhook Resend real;
- Cloud Run/Pages/Worker reais;
- deploy de índices Firestore.

Os testes opt-in continuam presentes e não foram convertidos em requisito da suíte normal.

## Conclusão de testes

O código passou pelas validações estáticas e funcionais auxiliares disponíveis, mas a suíte oficial não pôde ser executada por incompatibilidade do runtime e indisponibilidade da instalação npm. Portanto, a classificação desta versão é:

**Código candidato à homologação; validação completa pendente em ambiente compatível.**
