# Testes — versão 0.5.1

**Data:** 16/08/2026

Este documento separa estritamente os resultados da base 0.5.0 executados pelo usuário no Cloud Shell dos testes suplementares realmente executados durante a geração da 0.5.1.

## 1. Baseline executado na 0.5.0

Antes da correção, o usuário executou no Cloud Shell:

| Comando | Resultado observado na 0.5.0 |
|---|---|
| `npm ci` | concluído; audit inicial indicou 11 vulnerabilidades no conjunto completo |
| `npm run typecheck` | falhou com 2 erros: Busboy headers e propriedade `firestore` não utilizada |
| `npm run lint` | aprovado |
| `npm run test` | 118/139 testes aprovados; 21 falhas concentradas em multipart sob jsdom e Storage Emulator ausente |
| `npm run build` | aprovado; warning de chunk frontend >500 kB |
| `npm run validate` | interrompido no typecheck |
| `npm audit --omit=dev` | 7 vulnerabilidades: 6 moderadas e 1 alta |
| `npm audit` | 11 vulnerabilidades: 9 moderadas e 2 altas |
| `npm run test:rules` | Firestore deny-all aprovado; teste Storage falhou em propriedade getter-only antes de avaliar a regra |
| `npm run test:firebase` | 14/17 aprovados; 3 falhas de fixture por `import.meta.url` sob jsdom |
| `npm run test:storage` | **6/6 aprovados** |

A homologação funcional manual 1–28 da 0.5.0 também havia sido concluída com sucesso antes desta estabilização.

## 2. Verificações executadas na 0.5.1 neste ambiente

### 2.1 Inspeção integral do pacote de origem

- fonte: `olhos-do-campus (6).zip`;
- SHA-256 da fonte: `88d093e61dccbc0a66266bfaad4d076d29a863737b63cb5b6956c9dc87f61672`;
- 220 arquivos e 40 diretórios internos inspecionados;
- `package.json`, lockfile, TypeScript, servidor, serviços, repositórios, modelos, páginas, componentes e testes revisados antes das alterações.

### 2.2 Transpilação sintática TypeScript/TSX

Executada com o compilador TypeScript 5.8.3 disponível globalmente, sem resolução de dependências:

```text
144 arquivos TS/TSX
0 erros sintáticos
```

Esta checagem é suplementar e **não substitui `npm run typecheck`**.

### 2.3 JSON

Todos os arquivos JSON do projeto foram parseados:

```text
9 arquivos JSON
0 erros
```

### 2.4 Imports relativos

Foi feita inspeção estática de imports relativos TypeScript/TSX:

```text
485 imports relativos verificados
0 destinos ausentes
```

### 2.5 Lockfile e versões de segurança

Verificações estáticas aprovadas:

```text
sharp: 0.35.3
nanoid: 3.3.18
uuid compartilhado vulnerável: substituído por 11.1.1
@opentelemetry/core: 2.8.0
universal-analytics/uuid: 14.0.1 preservado
semantic-conventions: 1.39.0 compatível com a árvore atual
```

### 2.6 Ativos institucionais

Os quatro arquivos de marca preservaram os hashes homologados:

```text
horizontal: b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731
vertical:   a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427
```

### 2.7 Segredos e gerenciador de pacotes

Não foram encontrados no pacote de trabalho:

```text
.env
.env.local
bun.lock
yarn.lock
pnpm-lock.yaml
service-account.json
firebase-admin.json
```

O projeto continua usando npm/package-lock como única fonte de resolução.

### 2.8 Tipo `any`

Busca estática por usos explícitos de `any` em `src`, `server`, `scripts` e `tests`: nenhum uso encontrado.

## 3. Testes não executados após a alteração — limitação objetiva

O ambiente de geração não conseguiu acessar `registry.npmjs.org`:

```text
npm error code EAI_AGAIN
npm error request to https://registry.npmjs.org/sharp failed
npm error getaddrinfo EAI_AGAIN registry.npmjs.org
```

A coerência do `package-lock.json` foi validada com sucesso sem alterar dependências instaladas:

```bash
npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund
```

Resultado: **concluído com sucesso** (`up to date`). O npm emitiu apenas avisos de engine porque o runtime deste ambiente é Node 22.16.0 e algumas dependências de desenvolvimento resolvidas exigem Node mais recente.

Uma tentativa de instalar de fato toda a árvore por cache offline foi executada com:

```bash
npm ci --ignore-scripts --offline --no-audit --no-fund
```

e falhou porque o tarball de `zod-validation-error@4.0.2` não estava no cache:

```text
ENOTCACHED ... zod-validation-error-4.0.2.tgz ... cache mode is 'only-if-cached'
```

Consequência técnica: **não foram declarados como aprovados** na 0.5.1, neste ambiente, os comandos que dependem da instalação completa das dependências:

- `npm ci`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run test`;
- `npm run build`;
- `npm run validate`;
- `npm audit`;
- `npm audit --omit=dev`;
- `npm run test:rules`;
- `npm run test:firebase`;
- `npm run test:storage`.

## 4. Bateria obrigatória no Cloud Shell antes do deploy

Executar, nesta ordem:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm audit
npm audit --omit=dev
npm run test:rules
npm run test:firebase
npm run test:storage
```

### Critérios de aceite

- typecheck: 0 erros;
- lint: 0 erros/warnings;
- `npm run test`: todas as suítes ordinárias aprovadas, sem tentar acessar Storage Emulator;
- build: concluído;
- validate: concluído;
- `npm audit`: 0 vulnerabilidades;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- `test:rules`: 100% aprovado;
- `test:firebase`: 100% aprovado;
- `test:storage`: 6/6 ou total superior se novos testes forem adicionados, todos aprovados.

## 5. Regressão manual mínima após publicação

Como a 0.5.0 já passou pela homologação manual 1–28, não é necessário repeti-la integralmente se a bateria automatizada da 0.5.1 passar. Recomenda-se regressão curta das áreas tocadas:

1. login administrativo;
2. criação pública com 1 JPEG;
3. criação com PNG e WebP;
4. rejeição de GIF/TIFF/SVG ou arquivo disfarçado;
5. visualização da fotografia inicial no administrativo;
6. inclusão de fotografia de solução;
7. publicação de fotografia de solução e consulta pública;
8. exclusão e confirmação no histórico.
