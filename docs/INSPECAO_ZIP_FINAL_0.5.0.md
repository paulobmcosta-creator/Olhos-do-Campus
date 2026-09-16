# Inspeção do ZIP Final — versão 0.5.0

## 1. Procedimento

Foi criado um ZIP candidato a partir do diretório final de trabalho, excluindo artefatos de instalação/build/cache. O ZIP candidato foi testado com `unzip -t`, reextraído integralmente em diretório limpo e inspecionado sobre o conteúdo efetivamente empacotado.

Após a atualização deste relatório, o ZIP definitivo foi gerado novamente e submetido a uma confirmação final de reextração e integridade. Se qualquer diferença material fosse encontrada nessa confirmação, a entrega deveria ser refeita antes de disponibilização.

## 2. Resultado da reextração do candidato

- arquivos regulares reextraídos: **220**;
- `package.json`: versão **0.5.0**;
- `package-lock.json`: versão raiz **0.5.0**;
- `metadata.json`: versão **0.5.0**;
- `src/config/version.ts`: versão ativa **0.5.0**;
- `bun.lock`: ausente;
- `.env`: ausente;
- `node_modules`: ausente;
- `dist`: ausente;
- `coverage`: ausente;
- `.firebase-export`: ausente;
- `.vitest`: ausente.

Foram confirmados no ZIP:

- `firebase.json`;
- `firebase.ai-studio.json`;
- `firebase-applet-config.json`;
- `firebase-blueprint.json`;
- `firestore.rules`;
- `firestore.indexes.json`;
- `storage.rules`;
- novos serviços de imagem;
- repositories do Storage;
- testes de processamento, API, integração, rules, frontend e Storage;
- documentação 0.5.0;
- ativos institucionais.

## 3. Ativos institucionais

Hashes SHA-256 antes e depois da implementação e também no ZIP reextraído:

| Arquivo | SHA-256 | Resultado |
|---|---|---|
| `public/brand/ifes-bsf-horizontal.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` | preservado |
| `public/brand/originals/bsf-horizontal-cor.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` | preservado |
| `public/brand/ifes-bsf-vertical.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` | preservado |
| `public/brand/originals/bsf-vertical-cor.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` | preservado |

Nenhum ativo institucional foi modificado.

## 4. Segurança do conteúdo empacotado

### Arquivos/artefatos proibidos

Não foram encontrados:

- `.env`;
- service account;
- private key;
- arquivo PEM/P12;
- tokens persistidos;
- logs;
- cache de emuladores;
- `node_modules`;
- build `dist`;
- coverage;
- fotografias reais de usuários.

As únicas imagens novas da suíte são fixtures **sintéticas** destinadas a validar remoção de metadados.

### Varredura de conteúdo sensível

Foram executadas todas as buscas obrigatórias definidas para a entrega, incluindo marcadores de chave privada, indicadores de service account, campos de credencial, cabeçalhos de autorização, refresh token, chave de acompanhamento e os nomes dos contratos/flags legados de fotografias.

Avaliação:

- nenhum marcador ou conteúdo de chave privada foi encontrado;
- os identificadores de configuração de chave privada e e-mail de cliente aparecem somente em teste estático que verifica sua ausência no `.env.example`;
- nenhum arquivo ou conteúdo de service account foi encontrado;
- nenhum cabeçalho de autorização hard-coded ou refresh token foi encontrado;
- `trackingKey`: ocorrências legítimas nos contratos de entrada/saída, derivação criptográfica, consulta pública, documentação e testes; o código persiste `trackingKeyHash`/`trackingKeySalt`, não a chave clara no documento da ocorrência;
- `photoDataUrl` e `solutionPhotoDataUrl`: nenhuma referência em código de produção; ocorrências remanescentes estão restritas a testes negativos e CHANGELOG que documentam sua remoção;
- `ENABLE_TEMPORARY_PHOTO_STORAGE`: nenhuma referência em código ativo; a única referência histórica permanece no relatório 0.4.0 e há referência negativa na documentação 0.5.0;
- `temporaryPhotoStorageEnabled`: nenhuma ocorrência.

## 5. Arquitetura de fotografias no ZIP

Confirmado:

- `CloudStoragePhotoRepository` presente;
- `ImageProcessingService` presente;
- `PhotoService` presente;
- repository de metadados presente;
- repository de `storageCleanupTasks` presente;
- parser multipart com limites presente;
- `InMemoryPhotoRepository` e `DisabledPhotoRepository` não existem na produção;
- `temporaryPhotoRepository.ts` removido;
- `imageSanitizer.ts` antigo removido;
- Data URLs não fazem parte dos contratos ativos;
- bytes de fotografia não são serializados para o documento Firestore;
- caminhos de Storage são gerados pelo servidor;
- nome original não é usado para os paths persistidos.

## 6. Regras Firebase

`storage.rules` foi reaberto no conteúdo reextraído e permanece:

```text
allow read, write: if false;
```

Portanto, o cliente Web não recebe acesso direto ao bucket.

`firestore.rules` também permanece deny-all para acesso cliente aos documentos de domínio, incluindo `occurrences/{id}/photos` e `storageCleanupTasks`.

## 7. Terminologia institucional

A varredura integral não encontrou marca fantasia legada proibida, promessa de anonimato integral nem formulações absolutas de anonimato. Permanecem exclusivamente a identidade e a terminologia institucionais definidas para “Olhos do Campus”, para o “Sistema Institucional de Manutenção da Infraestrutura Física” e para “registro sem identificação pessoal obrigatória”.

## 8. TypeScript e imports

Foi executada verificação sintática suplementar sobre **144 arquivos TS/TSX**, com **0 diagnósticos de sintaxe**. A busca por token explícito `any` no código ativo retornou **0 ocorrências**.

Essa verificação não substitui `npm run typecheck`, que não pôde executar adequadamente por ausência das dependências instaladas.

## 9. Fotografias e dados de teste

O ZIP não contém objetos exportados do Storage Emulator nem fotografias reais de usuários. As imagens de `tests/fixtures/` são arquivos sintéticos criados exclusivamente para testes automatizados de processamento e metadados.

## 10. Resultado

A inspeção estrutural, de conteúdo, identidade, regras, versões, ativos e segurança do ZIP candidato foi **aprovada**.

A aprovação deste relatório refere-se à **integridade e composição do artefato**, não à certificação funcional para produção. A bateria executável permanece bloqueada pela indisponibilidade da instalação npm descrita em `docs/TESTES_0.5.0.md`; por isso a versão não é declarada pronta para produção neste ambiente.
