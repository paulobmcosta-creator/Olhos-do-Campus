# Relatório de implementação — versão 0.5.1

**Sistema:** Sistema Institucional de Manutenção da Infraestrutura Física — “Olhos do Campus”  
**Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco  
**Versão:** 0.5.1  
**Data:** 16/08/2026

## 1. Fonte de verdade e objetivo

A implementação foi produzida exclusivamente a partir do ZIP mais recente recebido para esta etapa, `olhos-do-campus (6).zip`, cujo SHA-256 é:

```text
88d093e61dccbc0a66266bfaad4d076d29a863737b63cb5b6956c9dc87f61672
```

O pacote continha 220 arquivos e 40 diretórios internos. A estrutura, `package.json`, `package-lock.json`, `tsconfig.json`, servidor, serviços, repositórios, modelos, páginas, componentes, utilitários, validações e testes foram inspecionados antes das alterações.

A 0.5.1 é uma versão de **estabilização e segurança**. Ela não altera o domínio funcional homologado na 0.5.0 e não introduz o escopo funcional previsto para a 0.6.0.

## 2. Diagnóstico de entrada

A homologação manual da 0.5.0 havia aprovado os testes funcionais 1 a 28, incluindo upload, persistência, privacidade, visibilidade de fotografias de solução, exclusão, histórico, optimistic locking, acesso administrativo, consulta pública protegida, server-only Storage e uso móvel.

Na verificação automatizada posterior em Cloud Shell foram encontrados quatro grupos de problemas:

1. dois erros de TypeScript;
2. testes HTTP multipart executados sob `jsdom`, gerando respostas 415 que não reproduziam o comportamento real já homologado;
3. testes dependentes de Firebase Emulators executados sem os emuladores ou com incompatibilidades da API de teste;
4. `npm audit` com 11 vulnerabilidades no conjunto completo de dependências — 9 moderadas e 2 altas — e `npm audit --omit=dev` com 7 vulnerabilidades de produção — 6 moderadas e 1 alta.

## 3. Correções de TypeScript

### 3.1 Multipart/Busboy

`server/middleware/multipartPhotos.ts` já rejeitava requisições sem `Content-Type` multipart válido, mas entregava `request.headers` diretamente ao Busboy. O tipo `IncomingHttpHeaders` admite `content-type` indefinido, enquanto `BusboyHeaders` exige a propriedade como `string`.

A configuração passou a fornecer explicitamente o `contentType` já validado:

```ts
headers: { ...request.headers, 'content-type': contentType }
```

Não foi utilizado `any` nem cast inseguro.

### 3.2 Repositório de tarefas de limpeza

`server/repositories/storageCleanupTaskRepository.ts` armazenava `firestore` como propriedade privada do objeto sem utilizá-la após a construção da referência da coleção. O parâmetro deixou de ser uma parameter property e continua sendo usado para inicializar `storageCleanupTasks`.

## 4. Estabilização da suíte de testes

### 4.1 Ambiente Node para testes de servidor

Os testes que exercitam APIs Node, `FormData`/`Blob` nativos, `import.meta.url` e Firebase Emulator Suite passaram a declarar:

```ts
// @vitest-environment node
```

Isso foi aplicado às suítes de API multipart, integração Firebase, integração Storage e regras Firebase. Testes React continuam no ambiente global `jsdom`. O `tests/setup.ts` foi tornado neutro ao ambiente, protegendo acessos a `window` e `sessionStorage` para não quebrar as suítes Node.

### 4.2 Separação de testes dependentes dos Emulators

`storageIntegration.test.ts` deixou de fazer parte do `npm test` ordinário. Ele permanece coberto pelo comando específico:

```bash
npm run test:storage
```

Assim, uma execução unitária sem Storage Emulator não produz `ECONNREFUSED 127.0.0.1:9199` artificial.

### 4.3 Regras do Storage

O teste removia/atribuía propriedades de retry em `StorageServiceCompat` que, na versão instalada do SDK, são somente leitura. Essas atribuições foram removidas. O teste volta a medir o que interessa: negação de leitura, escrita, exclusão e listagem para clientes Web.

### 4.4 Fixture em integração Firebase

A suíte `firebaseIntegration.test.ts` passou ao ambiente Node. Isso restabelece a semântica correta de `import.meta.url` para carregar a fixture JPEG e elimina o erro de `file:` observado sob `jsdom`.

## 5. Remediação de vulnerabilidades

### 5.1 Sharp/libvips — severidade alta

`sharp` foi atualizado de `0.34.1` para `0.35.3`, removendo a versão afetada indicada pelo audit da 0.5.0.

Como defesa adicional para entrada pública não confiável:

- JPEG, PNG e WebP são reconhecidos previamente por assinaturas binárias mínimas;
- SVG/XML, GIF, TIFF, VIPS e conteúdo arbitrário não seguem para a decodificação do fluxo normal;
- loaders `VipsForeignLoadNsgif`, `VipsForeignLoadTiff` e `VipsForeignLoadVips` são bloqueados explicitamente no `sharp`;
- a validação autoritativa posterior por metadata e a reencodificação para WebP foram preservadas;
- EXIF/GPS/XMP/IPTC continuam não sendo preservados.

### 5.2 `uuid`

A versão transitiva auditada `9.0.1` foi substituída de forma controlada por `11.1.1` apenas nas cadeias vulneráveis relevantes:

```json
"gaxios": { "uuid": "11.1.1" },
"teeny-request": { "uuid": "11.1.1" }
```

Não foi feito downgrade de `firebase-admin`. A dependência independente `universal-analytics` continua usando `uuid 14.0.1`, sem ser reduzida.

### 5.3 `@opentelemetry/core`

Foi aplicado override para `2.8.0`. Essa estratégia é compatível com a própria política atual do repositório oficial `firebase-tools`, que também aplica override para a linha corrigida do OpenTelemetry Core sobre sua cadeia do Pub/Sub.

### 5.4 `nanoid`

O lockfile foi atualizado para `nanoid 3.3.18`, removendo a versão anterior apontada pelo audit.

### 5.5 Política de atualização

Não foi utilizado `npm audit fix --force`, porque a sugestão automática observada no ambiente propunha alterações disruptivas/downgrades de componentes Firebase. A remediação foi deliberada e limitada aos pacotes identificados.

## 6. Compatibilidade arquitetural preservada

Permanecem inalterados os princípios homologados na 0.5.0:

- frontend React + TypeScript + Vite;
- backend Node.js + Express;
- Firebase Authentication anônima no público e Google Sign-In administrativo;
- Firebase App Check;
- Firestore como fonte de verdade do domínio;
- Cloud Storage apenas pelo backend/Admin SDK;
- `storage.rules` e `firestore.rules` deny-by-default para clientes Web;
- nenhuma Data URL/Base64 como persistência de fotografia;
- remoção de metadados por reencodificação;
- protocolo e chave de acompanhamento no fluxo público protegido;
- optimistic locking e histórico;
- sem credenciais incorporadas no código.

## 7. Testes e limitações desta geração

Os resultados efetivamente executados estão detalhados em `docs/TESTES_0.5.1.md`.

Neste ambiente de geração, o acesso direto ao `registry.npmjs.org` não estava disponível (`EAI_AGAIN`). A coerência do lockfile, contudo, foi validada com sucesso por `npm install --package-lock-only --ignore-scripts --offline --no-audit --no-fund`. Uma tentativa de `npm ci` offline não concluiu porque um tarball da árvore de desenvolvimento (`zod-validation-error@4.0.2`) não estava presente no cache (`ENOTCACHED`). Portanto, não é afirmado que `npm run typecheck`, lint, suíte Vitest, build ou `npm audit` tenham sido executados **após as alterações da 0.5.1** neste ambiente.

Foram executadas verificações suplementares locais de sintaxe, JSON, imports relativos, versões do lockfile, hashes dos ativos institucionais e ausência de arquivos de segredo. A confirmação executável final deve ser feita no Cloud Shell com acesso ao npm antes do deploy.

## 8. Instalação e validação recomendada

No Cloud Shell, após extrair o ZIP 0.5.1:

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

O resultado esperado para os dois audits é **0 vulnerabilidades**. Se qualquer audit ainda reportar ocorrência, não publicar a 0.5.1 antes de reavaliar a árvore efetivamente resolvida pelo npm.

## 9. Deploy

Nenhum deploy foi executado durante a geração desta entrega. A infraestrutura homologada anteriormente deve ser preservada: projeto, banco Firestore nomeado, bucket, App Check e política server-only.

Após a validação integral, a 0.5.1 pode substituir a revisão de aplicação da 0.5.0 sem migração de dados, pois não altera o modelo persistente de ocorrências/fotografias.

## 10. Pendências para decisão

- definir formalmente o prazo institucional de retenção das fotografias;
- reduzir futuramente o privilégio amplo da service account de runtime para papéis mínimos necessários;
- decidir se o warning de chunk frontend acima de 500 kB será tratado na 0.6.0;
- somente iniciar a 0.6.0 depois da confirmação executável da 0.5.1 no Cloud Shell.
