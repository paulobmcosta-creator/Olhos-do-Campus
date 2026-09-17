# Testes — versão 0.7.1

Data: 2026-08-18.

Ambiente disponível:

- Node.js: `v22.16.0`;
- npm: `10.9.2`;
- TypeScript global: `5.8.3`;
- Java: OpenJDK `21.0.11`;
- resolução DNS para `registry.npmjs.org` e `nodejs.org`: indisponível durante a execução.

## 1. Instalação limpa

### `npm ci`

**Resultado: BLOQUEADO PELO AMBIENTE.**

A árvore final exige Node `>=22.22.2 <23`, enquanto o sandbox possui 22.16.0. Além disso, o registry npm não pôde ser resolvido. O debug log registrou, entre outros:

```text
getaddrinfo EAI_AGAIN registry.npmjs.org
GET https://registry.npmjs.org/... failed with EAI_AGAIN
```

A tentativa offline também foi efetivamente executada e falhou porque o cache local não contém os tarballs:

```text
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz failed:
cache mode is 'only-if-cached' but no cached response is available.
```

O `node_modules` parcial produzido pelas tentativas foi removido antes do empacotamento.

## 2. Comandos obrigatórios efetivamente invocados

Os comandos abaixo foram chamados depois da tentativa de instalação. Como `node_modules` não pôde ser materializado, eles não chegaram à validação normal da aplicação.

| Comando | Exit | Resultado real | Classificação |
|---|---:|---|---|
| `npm run typecheck` | 2 | TS2688: tipos `@testing-library/jest-dom`, `node` e `vite/client` ausentes | BLOQUEADO PELO AMBIENTE |
| `npm run lint` | 127 | `eslint: not found` | BLOQUEADO PELO AMBIENTE |
| `npm run test` | 127 | `vitest: not found` | BLOQUEADO PELO AMBIENTE |
| `npm run worker:typecheck` | 2 | tipo `@cloudflare/workers-types` ausente | BLOQUEADO PELO AMBIENTE |
| `npm run worker:test` | 127 | `vitest: not found` | BLOQUEADO PELO AMBIENTE |
| `npm run build` | 127 | `vite: not found` | BLOQUEADO PELO AMBIENTE |
| `npm audit` | 1 | endpoint de audit falhou com `getaddrinfo EAI_AGAIN registry.npmjs.org` | BLOQUEADO PELO AMBIENTE |
| `npm audit --omit=dev` | 1 | endpoint de audit falhou com `getaddrinfo EAI_AGAIN registry.npmjs.org` | BLOQUEADO PELO AMBIENTE |
| `npm run test:rules` | 127 | `firebase: not found` | BLOQUEADO PELO AMBIENTE |
| `npm run test:firebase` | 127 | `firebase: not found` | BLOQUEADO PELO AMBIENTE |
| `npm run test:storage` | 127 | `firebase: not found` | BLOQUEADO PELO AMBIENTE |

Java está presente. Portanto, nesta execução os três comandos de Emulator Suite não foram bloqueados por Java, mas pela ausência do Firebase CLI decorrente da instalação npm incompleta.

## 3. Integrações opt-in

Também foram invocados:

| Comando | Exit | Resultado |
|---|---:|---|
| `npm run test:r2` | 127 | `vitest: not found`; nenhum acesso R2 real ocorreu |
| `npm run test:resend` | 127 | `vitest: not found`; nenhum e-mail real foi enviado |

Nenhuma credencial real foi configurada e nenhum recurso externo foi alterado.

## 4. Validações auxiliares executadas

Estas validações foram concluídas e ajudam a detectar erros estruturais, mas **não substituem** os comandos oficiais.

| Validação | Resultado |
|---|---|
| `git diff --check` | PASSOU |
| parse de JSONs críticos | PASSOU |
| parse de `cloudbuild.yaml` | PASSOU |
| TypeScript `transpileModule` em 211 arquivos TS/TSX | PASSOU — 0 erros sintáticos |
| funções puras de verificação Storage → R2 | PASSOU — 100/100, 99/100, hash divergente e destino ausente |
| classificação/precedência pura de entrega Resend | PASSOU — quota/config/destinatário e proteção contra regressão de estados |
| política Artifact/versão/região/Node/Worker | PASSOU estruturalmente |
| comparação de lockfiles 0.7.0 × 0.7.1 | PASSOU — 0 mudanças de versão nas dependências reais |
| `java -version` | PASSOU — OpenJDK 21.0.11 disponível |

## 5. Cobertura de regressão adicionada ao código

Foram adicionados:

- `tests/preDeployment071.test.ts`: 9 casos diretos;
- `tests/fallbackDeletion071.test.ts`: 8 cenários A–H;
- `tests/notificationDelivery071.test.ts`: casos de classificação parametrizada e 15 casos diretos de ordem/idempotência/incerteza;
- 4 casos adicionais em `tests/infrastructure070.test.ts`.

A árvore final possui 46 arquivos `tests/*.test.ts`, incluindo 2 opt-in. Nenhum teste da 0.7.0 foi removido.

A referência histórica informada pela 0.7.0 foi 41 arquivos aprovados, 213 testes aprovados e 2 opt-in ignorados. **Não é correto atribuir uma nova contagem de testes aprovados à 0.7.1**, pois o Vitest não pôde ser executado neste sandbox.

## 6. Vulnerabilidades

`npm audit` e `npm audit --omit=dev` **não puderam ser revalidados** por indisponibilidade de DNS/registry. A 0.7.0 havia reportado zero vulnerabilidades na mesma árvore de dependências; a comparação dos lockfiles confirma que a 0.7.1 não alterou versões de dependências e removeu apenas a dependência local inútil do Worker. Isso reduz a possibilidade de introdução por drift, mas não substitui um audit atual.

Situação da 0.7.1: **BLOQUEADO PELO AMBIENTE para auditoria atual de vulnerabilidades**.

## 7. Critério antes de implantação

Em ambiente com Node `>=22.22.2 <23` e acesso ao registry npm, repetir obrigatoriamente, sobre instalação limpa:

```text
npm ci
npm run typecheck
npm run lint
npm run test
npm run worker:typecheck
npm run worker:test
npm run build
npm audit
npm audit --omit=dev
npm run test:rules
npm run test:firebase
npm run test:storage
```

A versão somente deve avançar para candidata à implantação se todos os comandos aplicáveis passarem e as integrações externas forem homologadas conforme `HOMOLOGACAO_MANUAL_0.7.1.md`.
