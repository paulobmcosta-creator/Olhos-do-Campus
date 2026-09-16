# Inspeção do ZIP Final — 0.6.1

**Versão:** 0.6.1  
**Data:** 2026-08-17

## Fonte de verdade

A entrega foi construída exclusivamente a partir de `olhos-do-campus (11)(1).zip`, identificado internamente como 0.6.0.

## Escopo da inspeção

- versão ativa;
- package/lockfile;
- script de preparação de produção;
- ausência de `node_modules`;
- ausência de `.env` real;
- ausência de `bun.lock`/`bun.lockb` no pacote-fonte;
- ausência de caches/logs/temporários;
- ausência de credenciais privadas;
- preservação das marcas institucionais;
- comparação integral após extração do ZIP.

## Versionamento confirmado

- `package.json`: 0.6.1;
- `package-lock.json`: 0.6.1 na raiz e no pacote principal;
- `metadata.json`: 0.6.1;
- `firebase-blueprint.json`: 0.6.1;
- `src/config/version.ts`: 0.6.1;
- `/api/health`: obtém versão por `APP_VERSION`;
- RuntimeInfo: obtém versão por `APP_VERSION`.

## Empacotamento de produção

O `scripts.build` termina em:

```text
node scripts/prepareProductionPackage.mjs
```

O script executa:

```text
npm prune --omit=dev --no-audit --no-fund
```

Depois remove `bun.lock` e `bun.lockb` se existirem. Falhas de `npm prune` encerram a preparação com código diferente de zero.

## Artefatos proibidos

Na árvore preparada para ZIP:

- `node_modules`: ausente;
- `.env`: ausente;
- `bun.lock`: ausente;
- `bun.lockb`: ausente;
- logs: ausentes;
- arquivos temporários: ausentes;
- caches Firebase/Vitest: ausentes.

## Credenciais

Não foram encontrados valores de private key, service account, refresh token, Bearer token, `GEMINI_API_KEY` ou chave com prefixo `AQ.`. Menções textuais em documentos históricos/testes negativos não constituem credenciais.

## Marcas institucionais

Hashes SHA-256 preservados em relação à base 0.6.0:

- horizontal: `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731`;
- vertical: `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427`.

## Validação do ZIP extraído

A extração de verificação contém 272 arquivos, exatamente os mesmos 272 arquivos da árvore preparada:

- arquivos ausentes: 0;
- arquivos extras: 0;
- divergências SHA-256: 0;
- `unzip -t`: nenhum erro;
- `.env.example`: preservado;
- `.env` real e variantes locais: ausentes.

Uma primeira montagem de conferência revelou que um padrão de exclusão excessivamente amplo também retiraria `.env.example`; o padrão foi corrigido antes da geração definitiva. O ZIP disponibilizado preserva corretamente `.env.example` e exclui somente arquivos de ambiente reais/locais.
