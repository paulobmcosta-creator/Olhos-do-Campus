# Testes — 0.6.1

**Versão:** 0.6.1  
**Data:** 2026-08-17

## Resumo

A alteração é restrita à preparação do pacote de produção. Foram executados testes estáticos e um teste funcional isolado do prune. A suíte completa não pôde ser executada porque as dependências não puderam ser instaladas integralmente neste ambiente.

## Comandos executados

### Coerência do lockfile

```bash
npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund
```

**Resultado:** exit code 0, concluído em aproximadamente 0,6 s.  
**Warnings:** Node 22.16.0 é inferior ao requisito declarado por `jsdom@30.0.1` (22.22.2+) e `undici@8.10.0` (22.19.0+).  
**Consequência:** lockfile coerente; nenhuma dependência foi modificada.

### Sintaxe do script de produção

```bash
node --check scripts/prepareProductionPackage.mjs
```

**Resultado:** exit code 0.

### Validação de JSON

Foram parseados com Node:

- `package.json`;
- `package-lock.json`;
- `metadata.json`;
- `firebase-blueprint.json`;
- `firebase-applet-config.json`;
- `firebase.json`;
- `firestore.indexes.json`.

**Resultado:** exit code 0; todos válidos.

### Teste funcional isolado do prune

Foi criada fixture temporária com:

- módulo `prod-only` em `dependencies`;
- módulo `dev-only` em `devDependencies`;
- `bun.lock`;
- `bun.lockb`.

Executado:

```bash
node scripts/prepareProductionPackage.mjs
```

**Resultado:** exit code 0.

Validações observadas:

- `dev-only`: removido;
- `prod-only`: preservado;
- `bun.lock`: removido;
- `bun.lockb`: removido.

### npm ci offline

```bash
npm ci --offline --no-audit --no-fund
```

**Resultado:** exit code 1.

Erro principal:

```text
ENOTCACHED: zod-validation-error-4.0.2.tgz não está disponível no cache local.
```

Também foram emitidos os warnings de engine já citados.

### npm ci online

A tentativa online permaneceu aguardando o registry e precisou ser interrompida. Não houve instalação completa utilizável para executar a suíte Vitest/Vite/ESLint.

## Comandos não concluídos neste ambiente

Por dependerem de `npm ci` completo, não foram considerados executados com sucesso:

```bash
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

Eles devem ser repetidos em ambiente com Node compatível e acesso ao npm registry.

## Teste de regressão adicionado

`tests/productionPackaging061.test.ts` valida, quando Vitest estiver disponível:

1. remoção de dependência exclusivamente de desenvolvimento;
2. preservação de dependência de produção;
3. remoção de `bun.lock`;
4. remoção de `bun.lockb`;
5. presença da etapa de preparação no `scripts.build`.

## Critério específico de publicação

Após o próximo Publish, recomenda-se validar o artefato gerado pelo AI Studio com:

```bash
gzip -t build_artifacts.tar.gz
tar -tzf build_artifacts.tar.gz >/dev/null
```

Ambos devem retornar exit code 0.
