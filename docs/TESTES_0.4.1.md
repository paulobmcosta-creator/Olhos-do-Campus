# Relatório de testes — versão 0.4.1

Data da validação desta entrega: **2026-08-13**.

## 1. Contexto

O usuário informou que, antes deste patch, a suíte disponível no Google AI Studio havia passado integralmente. Essa informação é relevante para caracterizar a base recebida, mas **não é tratada neste relatório como execução própria da 0.4.1**.

A validação independente deste ambiente voltou a ser limitada pela indisponibilidade das dependências npm. Nenhum comando bloqueado é marcado como aprovado.

## 2. Ambiente desta validação

```text
Node.js: v22.16.0
npm: 10.9.2
```

Durante `npm ci`, foram emitidos avisos `EBADENGINE` para dependências de desenvolvimento que requerem patches mais recentes do Node 22. Isso não prova defeito do código, mas é uma limitação adicional deste ambiente de validação.

## 3. Comandos obrigatórios executados

| Comando | Código de saída | Duração observada | Resultado |
|---|---:|---:|---|
| `npm ci --no-audit --no-fund` | 124 | 60 s | não concluiu dentro do limite; instalação interrompida |
| `npm run typecheck` | 2 | 1 s | dependências/tipos não instalados (`@testing-library/jest-dom`, `node`, `vite/client`) |
| `npm run lint` | 127 | <1 s | `eslint: not found` |
| `npm run test` | 127 | <1 s | `vitest: not found` |
| `npm run build` | 127 | <1 s | `vite: not found` |
| `npm run validate` | 2 | 1 s | interrompido no typecheck por tipos ausentes |
| `npm audit --omit=dev` | 1 | 6 s | `EAI_AGAIN registry.npmjs.org` |
| `npm run test:rules` | 127 | <1 s | `firebase: not found` |
| `npm run test:firebase` | 127 | 1 s | `firebase: not found` |
| `npm run firebase:seed-reference-data` | 127 | <1 s | `tsx: not found` |
| `npm run firebase:seed-demo-data` | 127 | <1 s | `tsx: not found` |
| `npm run firebase:bootstrap-admin -- --email=admin@ifes.edu.br --display-name=Teste --emulator --dry-run` | 127 | <1 s | `tsx: not found` |

## 4. Diagnóstico complementar da instalação

Foi executado:

```bash
npm ci --offline --no-audit --no-fund
```

Resultado:

```text
ENOTCACHED
request to https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz failed:
cache mode is 'only-if-cached' but no cached response is available.
```

Esse resultado, combinado com o `EAI_AGAIN` do `npm audit`, confirma que o cache local é insuficiente e o acesso ao registro npm não estava funcional neste ambiente.

## 5. Verificações complementares efetivamente executadas

Essas verificações **não substituem** TypeScript completo, ESLint, Vitest, build ou Emulator Suite, mas foram utilizadas para reduzir risco de erro estrutural enquanto a instalação estava bloqueada.

### 5.1 Transpilação sintática TypeScript

Foram lidos e transpilados individualmente **128 arquivos `.ts`/`.tsx`**, excluindo declarações `.d.ts`, usando TypeScript 5.8.3.

Resultado:

```text
FILES=128
SYNTAX_ERRORS=0
```

### 5.2 Imports relativos

Busca integral por imports relativos em `src`, `server`, `scripts` e `tests`.

Resultado:

```text
MISSING_RELATIVE_IMPORTS=0
```

### 5.3 JSON

Os seguintes arquivos foram efetivamente parseados com sucesso:

- `package.json`;
- `package-lock.json`;
- `metadata.json`;
- `firebase.json`;
- `firebase.ai-studio.json`;
- `firebase-blueprint.json`;
- `firebase-applet-config.json`;
- `firestore.indexes.json`.

### 5.4 Resolução Firebase 0.4.1

`server/config/firebaseRuntime.ts` foi transpilado e executado diretamente fora do Vitest para comprovar cinco casos críticos:

1. AI Studio sem Emulator → projeto `gen-lang-client-0120954905` + databaseId nomeado;
2. `GOOGLE_CLOUD_PROJECT` igual ao projeto gerenciado → ambiente prevalece e mantém o databaseId nomeado correspondente;
3. `GOOGLE_CLOUD_PROJECT` diferente do arquivo gerenciado → não herda databaseId de outro projeto e utiliza `(default)`;
4. Emulator → `olhos-do-campus-local` + `(default)`;
5. `olhos-do-campus-local` sem Emulator → rejeição imediata.

Resultado:

```text
FIREBASE_RUNTIME_SEMANTIC_CHECK=PASS
```

### 5.5 Regressão do Storage

Inspeção do teste confirma novamente a presença de `uploadBytes(...)` dentro de `tests/firebaseRules.test.ts`, além de leitura e listagem negadas.

## 6. Testes adicionados/preparados na 0.4.1

`tests/firebaseRuntime.test.ts` cobre:

- fallback pelo `firebase-applet-config.json`;
- databaseId nomeado;
- Emulator no database `(default)`;
- bloqueio do projeto local sem Emulator;
- overrides explícitos;
- não herdar databaseId de projeto diferente;
- divergência entre `FIREBASE_PROJECT_ID` e `GOOGLE_CLOUD_PROJECT`;
- validação mínima do arquivo gerenciado.

`tests/staticPolicy.test.ts` foi ampliado para comprovar:

- ausência da capacidade Gemini em `metadata.json`;
- presença do projectId/databaseId gerenciados;
- configuração dedicada `firebase.ai-studio.json`;
- blueprint alinhado ao domínio real.

## 7. Consequência técnica

A 0.4.1 **não deve ser declarada validada para produção com base nesta execução independente**, pois as suítes críticas não puderam ser rodadas neste ambiente após a alteração.

O fato de a base 0.4.0 ter passado nos testes do AI Studio é um bom sinal, mas o patch 0.4.1 precisa ser novamente submetido, no ambiente do usuário, a:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm audit --omit=dev
npm run test:rules
npm run test:firebase
```

Depois, o Preview deve confirmar conexão ao projectId/databaseId reais e os fluxos de Authentication.
