# Relatório de Testes — versão 0.5.0

## 1. Princípio de registro

Este documento registra somente comandos efetivamente tentados e verificações realmente executadas. A indisponibilidade do registro npm impediu uma instalação íntegra de `node_modules`; por isso, os testes que dependem dos executáveis locais não são classificados como aprovados.

## 2. Etapa zero — base 0.4.1

Antes das alterações, foram tentados `npm ci`, TypeScript, lint, testes, build, validação, auditoria, regras e integração Firebase. `npm audit --omit=dev` registrou `EAI_AGAIN registry.npmjs.org`, e `npm ci` não conseguiu concluir a instalação. Os demais comandos ficaram sem suas dependências locais. Consequentemente, a base 0.4.1 não foi declarada validada por execução.

Não foi identificado, por execução, defeito comprovadamente preexistente que pudesse ser separado da indisponibilidade do ambiente.

## 3. Bateria final obrigatória da 0.5.0

| Comando | Código de saída | Duração registrada | Resultado |
|---|---:|---:|---|
| `npm ci` | 137 | 10 s | **Não concluído.** A tentativa final registrada foi encerrada por SIGKILL após novo bloqueio; tentativas anteriores também permaneceram sem concluir. Foram emitidos warnings de engine. |
| `npm run typecheck` | 2 | <1 s | **Não executou adequadamente.** Faltam definições de tipos porque `npm ci` não terminou. |
| `npm run lint` | 127 | <1 s | **Não executou.** `eslint` ausente. |
| `npm run test` | 127 | <1 s | **Não executou.** `vitest` ausente. |
| `npm run build` | 127 | <1 s | **Não executou.** `vite` ausente. |
| `npm run validate` | 2 | 1 s | **Não concluiu.** Interrompeu no `typecheck` pelas definições ausentes. |
| `npm audit --omit=dev` | 1 | 6 s | **Não concluiu.** `getaddrinfo EAI_AGAIN registry.npmjs.org`. |
| `npm run test:rules` | 127 | <1 s | **Não executou.** `firebase` CLI local ausente. |
| `npm run test:firebase` | 127 | <1 s | **Não executou.** `firebase` CLI local ausente. |
| `npm run test:storage` | 127 | <1 s | **Não executou.** `firebase` CLI local ausente. |

### Warnings relevantes de `npm ci`

No ambiente disponível (`Node v22.16.0`, `npm 10.9.2`) foram registrados:

- `jsdom@30.0.1`: engine declarada `^22.22.2 || ^24.15.0 || >=26.0.0`;
- `undici@8.10.0`: engine declarada `>=22.19.0`.

Esses warnings devem ser reavaliados em ambiente com versão de Node compatível. Não foram convertidos em erro funcional demonstrado porque a instalação não chegou ao fim.

## 4. Diagnóstico da indisponibilidade

`npm audit --omit=dev` retornou:

```text
npm warn audit request to https://registry.npmjs.org/-/npm/v1/security/audits/quick failed,
reason: getaddrinfo EAI_AGAIN registry.npmjs.org
npm error audit endpoint returned an error
```

Além disso, uma tentativa offline de instalação chegou a dependência não presente no cache (`ENOTCACHED`), confirmando que o cache local não era suficiente para completar a instalação.

## 5. Verificações suplementares efetivamente executadas

Estas verificações **não substituem** `typecheck`, lint, build ou testes:

1. Parse/estrutura de `package.json`, `package-lock.json` e arquivos JSON relevantes.
2. Verificação sintática com a instalação global disponível do TypeScript por `transpileModule`: **144 arquivos TS/TSX analisados, 0 diagnósticos de sintaxe**.
3. Verificação estrutural do lockfile com `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`: conclusão sem erro estrutural do lockfile antes da bateria final.
4. Varreduras textuais de segurança e terminologia no conteúdo final.
5. Comparação SHA-256 dos ativos institucionais antes/depois.
6. Reextração e inspeção do ZIP final em diretório limpo.

## 6. Testes implementados no código

### Processamento de imagem

A suíte `tests/imageProcessingService.test.ts` cobre, entre outros:

- JPEG, PNG e WebP válidos;
- SVG/GIF rejeitados;
- conteúdo não imagem e corrompido;
- MIME declarado diferente do conteúdo;
- tamanho acima de 8 MB;
- limite de pixels;
- redimensionamento, proporção e ausência de upscale;
- WebP final e miniatura;
- SHA-256;
- EXIF, GPS, XMP/texto, orientação e ausência de nome original.

### PhotoService e compensação

`tests/photoService.test.ts` cobre:

- paths gerados pelo servidor;
- visibilidade inicial interna;
- limite de quantidade;
- rollback parcial;
- criação de cleanup task se a compensação falhar;
- idempotência.

### Storage Emulator

`tests/storageIntegration.test.ts` foi preparado para:

- upload/leitura/exclusão;
- principal e miniatura;
- metadata/content-type;
- ausência de download token;
- path seguro;
- cleanup idempotente;
- falha injetada em upload;
- rollback do primeiro objeto;
- cleanup task em falha de exclusão compensatória.

### Firestore + Storage

`tests/firebaseIntegration.test.ts` foi adaptado para:

- ocorrência sem/1/3 fotografias;
- rejeição da 4ª;
- metadados READY;
- ausência de bytes/Data URLs no Firestore;
- fotografia inicial INTERNAL;
- solução INTERNAL → PUBLIC;
- exclusão lógica/física;
- optimistic locking.

### API pública e administrativa

`tests/photoApi.test.ts` cobre os contratos de criação multipart, Auth/App Check, limites, arquivo inválido, download público, não enumeração de interna/inexistente, permissões por papel, upload de solução, visibilidade, exclusão e 409 de versão.

### Security Rules

`tests/firebaseRules.test.ts` foi atualizado para negar acesso cliente direto ao Storage para não autenticado, anônimo, Google autenticado e usuário administrativo, incluindo read/write/delete/list; também nega acesso cliente às novas estruturas Firestore.

### Frontend

Foram adicionados/adaptados testes para processamento no cliente, seleção/limite/remoção/revisão multipart e galerias protegidas.

## 7. Testes que não chegaram a executar seus corpos

Devido à instalação incompleta:

- testes unitários Vitest;
- testes React/Vitest;
- testes do Storage Emulator;
- testes Firestore/Auth/Storage Emulator;
- testes de Firebase Security Rules;
- build Vite/esbuild;
- lint ESLint;
- typecheck TypeScript completo.

O teste funcional no Preview do Google AI Studio também **não foi executado** neste ambiente.

## 8. Condição para nova validação

Em ambiente com acesso ao registro npm e Node compatível, executar exatamente:

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
npm run test:storage
```

Somente após resultados bem-sucedidos desses comandos e validação funcional no Preview a versão poderá ser promovida para avaliação de produção.

## 9. Script administrativo de cleanup

O comando adicional `npm run storage:cleanup` também foi tentado após a bateria final. Resultado: código 127, duração inferior a 1 segundo, porque o executável local `tsx` não estava disponível em consequência do `npm ci` incompleto. O script não foi executado contra nenhum projeto Firebase real.
