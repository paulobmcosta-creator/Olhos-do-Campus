# Inspeção do ZIP Final — 0.6.2

**Versão:** 0.6.2  
**Base:** 0.6.1 integral recebida pelo usuário  

## Integridade do pacote

Foi gerado um ZIP candidato, extraído em diretório limpo e comparado com a árvore preparada.

- arquivos na árvore preparada: 277;
- arquivos após reextração: 277;
- arquivos ausentes: 0;
- arquivos extras: 0;
- diferenças SHA-256: 0;
- `unzip -t`: nenhum erro detectado.

## Versionamento

Confirmado em:

- `package.json`: 0.6.2;
- `package-lock.json`: 0.6.2 na raiz e no pacote principal;
- `metadata.json`: 0.6.2;
- `firebase-blueprint.json`: 0.6.2;
- `src/config/version.ts`: 0.6.2.

O contrato de bootstrap não contém literal ativo de versão: `RuntimeInfo.version` usa `typeof APP_VERSION` e o schema Zod usa `z.literal(APP_VERSION)`.

## Segurança e limpeza

Não foram encontrados:

- `.env` real;
- `node_modules`;
- `dist` no ZIP-fonte;
- `bun.lock` ou `bun.lockb`;
- chaves privadas;
- service accounts;
- refresh tokens;
- Bearer tokens;
- chave Gemini exposta;
- caches ou diretório `.git`.

` .env.example` permanece como documentação de configuração, sem credenciais reais.

## Marcas institucionais

Hashes preservados:

- horizontal: `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731`;
- vertical: `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427`.

## Resultado

Pacote considerado íntegro para nova importação no Google AI Studio e teste em Preview. A correção da 0.6.2 é restrita ao contrato de bootstrap/versionamento e preserva a preparação de pacote de produção introduzida na 0.6.1.
