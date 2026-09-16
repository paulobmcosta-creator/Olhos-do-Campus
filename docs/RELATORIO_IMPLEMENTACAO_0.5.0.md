# Relatório de Implementação — versão 0.5.0

## 1. Identificação

- **Nome fantasia:** Olhos do Campus
- **Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física
- **Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco
- **Versão:** 0.5.0
- **Base inspecionada:** ZIP recebido nesta etapa, confirmado no código como versão 0.4.1
- **Escopo:** ciclo completo e seguro de fotografias com Cloud Storage for Firebase, sem acesso direto do navegador ao bucket.

## 2. Resumo executivo

A versão 0.5.0 substitui o armazenamento temporário de fotografias da 0.4.1 por uma arquitetura persistente **server-only** baseada no Firebase Admin SDK. Os bytes das imagens passam a existir exclusivamente no Cloud Storage; o Firestore mantém a existência lógica, metadados, visibilidade, status e auditoria. O navegador não utiliza o SDK Web do Storage para upload ou leitura.

Foram implementados upload multipart, processamento no navegador como otimização, reprocessamento autoritativo no servidor com `sharp`, redimensionamento, reencodificação WebP, miniaturas, SHA-256, controle de metadados, compensação explícita entre Storage e Firestore, fila persistente de limpeza, histórico de imagens, optimistic locking, endpoints protegidos de leitura e operações administrativas por papel.

A versão **não é declarada apta para produção neste ambiente**, porque a indisponibilidade do registro npm impediu `npm ci` e, por consequência, a execução real das suítes completas de TypeScript, lint, testes, build, regras e emuladores. A limitação está detalhada em `docs/TESTES_0.5.0.md`.

## 3. Validação da base 0.4.1

Antes das alterações, a estrutura integral do ZIP foi extraída e inspecionada. O conteúdo real confirmou a versão 0.4.1 e os seguintes pontos de partida:

- ocorrências, histórico, protocolo e versionamento no Firestore;
- consulta pública por protocolo e chave no corpo da requisição;
- Firebase Authentication anônima no fluxo público;
- Google Sign-In no fluxo administrativo;
- App Check;
- `adminUsers`, papéis e autorização;
- optimistic locking por `version`;
- Firestore nomeado provisionado pelo Google AI Studio;
- `storageBucket` presente na configuração do applet;
- `storage.rules` em deny-all;
- fotografias temporárias em memória;
- Data URLs no contrato de fotografias;
- ausência de bytes de fotografias persistidos no Firestore.

Valores confirmados no ZIP recebido, sem transformá-los em constantes universais:

- `projectId`: `gen-lang-client-0120954905`
- `databaseId`: `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`
- `storageBucket`: `gen-lang-client-0120954905.firebasestorage.app`

A validação executável da 0.4.1 foi tentada antes da implementação. O registro npm não pôde ser alcançado de forma confiável; `npm audit` registrou `EAI_AGAIN registry.npmjs.org`, e as tentativas de `npm ci` não concluíram. Por isso, a base não foi declarada validada por execução.

## 4. Arquitetura implementada

### 4.1 Fluxo público de criação

`Frontend → Express API → App Check → Firebase Authentication → parser multipart com limites → ImageProcessingService → PhotoService → Firebase Admin Storage → transação Firestore`

- até 3 fotografias iniciais;
- formato binário por `multipart/form-data`;
- campo estruturado `payload` e campo de arquivos `photos`;
- autenticação e App Check são avaliados antes do parser multipart;
- o nome original do arquivo não é utilizado no domínio, Storage path ou metadados;
- fotografias iniciais são `INITIAL`, `INTERNAL` e `READY` após a criação bem-sucedida.

### 4.2 Fluxo administrativo

Administrador e Gestor podem adicionar, visualizar, excluir e alterar visibilidade de fotografias de solução. Atendente pode adicionar e visualizar em ocorrência atribuída e acessível, mas não pode excluir nem alterar visibilidade.

Operações que alteram o conjunto ou a visibilidade das fotos exigem `expectedVersion`, incrementam `version` e produzem eventos de histórico.

### 4.3 Fonte de verdade

- **Firestore:** fonte de verdade da existência lógica e estado da fotografia.
- **Cloud Storage:** fonte dos bytes da imagem principal e miniatura.

Objetos do bucket não são listados para descobrir fotografias de uma ocorrência.

## 5. Processamento de imagens

### Cliente

- validação preliminar de JPEG/PNG/WebP;
- limite preliminar de 8 MB;
- redimensionamento sem ampliação para maior lado de até 1600 px;
- reencodificação WebP com qualidade aproximada 0,82;
- `Blob`/`File` para transmissão;
- `ObjectURL` somente para visualização local, com revogação.

### Servidor

Implementado em `server/services/imageProcessingService.ts` com `sharp`:

- limite máximo de arquivo: 8 MB;
- limite de entrada: 40 megapixels;
- formatos permitidos: JPEG, PNG e WebP;
- rejeição de SVG, GIF, conteúdo arbitrário, imagem corrompida e MIME incompatível;
- rejeição de imagens com múltiplas páginas/frames;
- aplicação de orientação;
- imagem principal: até 1600 px no maior lado;
- miniatura: até 480 px no maior lado;
- WebP, qualidade aproximada 82;
- ausência de ampliação desnecessária;
- nova codificação integral sem preservação explícita de metadados;
- SHA-256 calculado sobre a imagem principal final.

Fixtures sintéticas e testes foram adicionados para EXIF, GPS, orientação, texto e XMP. A execução desses testes ficou bloqueada pela instalação incompleta das dependências; o código de teste permanece no projeto para execução assim que o ambiente npm estiver funcional.

## 6. Cloud Storage

### Caminhos

```text
occurrences/{occurrenceId}/initial/{photoId}.webp
occurrences/{occurrenceId}/initial-thumbnails/{photoId}.webp
occurrences/{occurrenceId}/resolution/{photoId}.webp
occurrences/{occurrenceId}/resolution-thumbnails/{photoId}.webp
```

Os IDs são gerados no servidor. O cliente não informa Storage path.

### Metadados do objeto

- `contentType: image/webp`;
- `contentDisposition: inline` sem nome original;
- política de cache privada;
- custom metadata apenas técnica: `occurrenceId`, `photoId`, `kind`, `schemaVersion`;
- nenhum Firebase Download Token é criado como arquitetura ordinária.

## 7. Metadados Firestore

Subcoleção:

```text
occurrences/{occurrenceId}/photos/{photoId}
```

Campos implementados incluem:

- `schemaVersion`;
- `kind`;
- `visibility`;
- `status`;
- `storagePath`;
- `thumbnailStoragePath`;
- `contentType`;
- `width` e `height`;
- `byteSize` e `thumbnailByteSize`;
- `sha256`;
- `createdAt`;
- `createdByType`;
- dados administrativos mínimos quando aplicáveis;
- dados de exclusão lógica quando aplicáveis.

Não há bytes ou Data URL nesse documento.

## 8. Consistência, rollback e órfãos

Storage e Firestore não possuem transação conjunta. A 0.5.0 implementa compensação explícita:

1. validar e processar arquivos;
2. gerar IDs;
3. enviar principal e miniatura;
4. executar a transação Firestore;
5. se a transação falhar, excluir os objetos recém-enviados;
6. se a compensação falhar, criar `storageCleanupTasks/{taskId}`.

O script `npm run storage:cleanup` processa somente tarefas persistentes válidas, é idempotente e considera objeto já inexistente como sucesso.

## 9. Endpoints de fotografias

### Alterado

- `POST /api/occurrences` — passa a aceitar `multipart/form-data`, zero a três fotografias.

### Adicionados

- `POST /api/occurrences/track/photo` — retorna bytes de fotografia pública mediante App Check, Auth anônima, protocolo, chave e `photoId`.
- `GET /api/admin/occurrences/:occurrenceId/photos/:photoId?variant=thumbnail|full` — leitura administrativa protegida.
- `POST /api/admin/occurrences/:occurrenceId/photos` — adiciona fotografias de solução com `expectedVersion`.
- `PATCH /api/admin/occurrences/:occurrenceId/photos/:photoId/visibility` — altera visibilidade com `expectedVersion`.
- `DELETE /api/admin/occurrences/:occurrenceId/photos/:photoId` — exclusão lógica + tentativa de exclusão física com `expectedVersion`.

As respostas de imagem usam `Content-Type: image/webp`, `X-Content-Type-Options: nosniff` e cache privado/não compartilhável.

## 10. Permissões por papel

| Operação | Administrador | Gestor | Atendente atribuído | Atendente não atribuído |
|---|---:|---:|---:|---:|
| Visualizar fotos da ocorrência acessível | Sim | Sim | Sim | Não |
| Adicionar foto de solução | Sim | Sim | Sim | Não |
| Alterar visibilidade | Sim | Sim | Não | Não |
| Excluir foto | Sim | Sim | Não | Não |

A fotografia de solução nasce `INTERNAL`. Torná-la `PUBLIC` exige ação explícita de Administrador ou Gestor.

## 11. Histórico e locking

Foram acrescentados eventos de fotografia semanticamente equivalentes a:

- `PHOTO_ADDED`;
- `PHOTO_DELETED`;
- `PHOTO_VISIBILITY_CHANGED`.

As ações administrativas de inclusão, exclusão e visibilidade verificam `expectedVersion`. Conflito retorna HTTP 409 com a mensagem:

> A ocorrência foi atualizada por outro usuário. Recarregue os dados antes de continuar.

## 12. Frontend

- Data URLs removidas dos contratos ativos;
- formulário público com até 3 fotografias, captura por câmera e galeria;
- pré-visualização, remoção antes do envio, quantidade na revisão e estados de processamento/envio;
- galeria administrativa separada em “Fotografias do registro” e “Fotografias da solução”;
- miniaturas carregadas primeiro;
- versão ampliada sob demanda;
- bytes obtidos exclusivamente pela API;
- `ObjectURL` revogada quando não é mais necessária;
- consulta pública exibe somente fotografias de solução explicitamente `PUBLIC` e `READY`.

## 13. Firebase Runtime e Emulator Suite

O Firebase Admin continua inicializado uma única vez. A configuração foi estendida para Storage e bucket.

Prioridade de resolução do bucket:

1. `FIREBASE_STORAGE_BUCKET`;
2. `storageBucket` de `firebase-applet-config.json`, apenas quando o projeto selecionado corresponde ao projeto do arquivo;
3. bucket local coerente no modo Emulator.

A configuração rejeita host vazio/inválido, protocolo em `FIREBASE_STORAGE_EMULATOR_HOST`, configuração parcial de emuladores e mistura evidente entre projectId e bucket padrão de outro projeto.

Em Emulator, Auth, Firestore e Storage devem ser configurados conjuntamente. O valor documentado para o Storage Emulator é:

```text
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

## 14. Regras Firebase

`storage.rules` permanece deny-all para clientes Firebase Web. Nenhuma autenticação cliente concede leitura, gravação, exclusão ou listagem direta.

`firestore.rules` preserva a arquitetura server-only; a subcoleção `photos` e `storageCleanupTasks` não são acessíveis diretamente pelo navegador.

## 15. Dependências

### Adicionadas

- `@fastify/busboy@3.2.0` — parsing multipart com limites.
- `sharp@0.34.1` — validação/decodificação/reencodificação/redimensionamento/miniatura no servidor.

### Removidas

Nenhuma dependência de pacote foi removida nesta versão. Foram removidos componentes de código da arquitetura temporária de fotografias.

## 16. Arquivos removidos

- `server/repositories/temporaryPhotoRepository.ts`
- `server/utils/imageSanitizer.ts`
- `tests/imageSanitizer.test.ts`

A relação integral de arquivos criados e modificados está em `docs/ARQUIVOS_0.5.0.md`.

## 17. Segurança e privacidade

- não há upload/leitura direta pelo SDK Web do Storage;
- não se utiliza nome original para caminho ou persistência;
- tracking key não é inserida em URL de fotografia;
- fotografia interna e fotografia inexistente usam resposta pública não enumerável;
- logs não devem conter buffers, Base64, tokens, chave de acompanhamento ou metadados originais;
- política de retenção não foi inventada.

**Prazo de retenção: pendente de decisão institucional.**

## 18. Instalação

Pré-requisito do projeto: Node compatível com o `package.json` e acesso ao registro npm.

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

## 19. Emulator Suite

Configurar o ambiente local de forma coerente, incluindo:

```text
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

Depois:

```bash
npm run emulators
```

Ou executar as suítes específicas:

```bash
npm run test:rules
npm run test:firebase
npm run test:storage
```

## 20. Configuração do bucket

Em produção/Preview, informar `FIREBASE_STORAGE_BUCKET` quando a resolução automática não puder ser feita com segurança. O valor deve corresponder ao mesmo projeto Firebase selecionado. Não usar protocolo e não utilizar bucket pertencente a outro projeto.

## 21. Google AI Studio Preview

Antes do Preview, confirmar os três identificadores efetivos no ambiente provisionado:

```text
projectId
databaseId
storageBucket
```

No ZIP desta entrega, a configuração de referência continua apontando para o projeto e banco nomeado confirmados na base recebida. Nenhum deploy de produção foi executado nesta versão.

O teste funcional no Preview não foi executado neste ambiente, porque não há uma instância provisionada/implantada desta versão nem instalação completa das dependências locais.

## 22. Limitações conhecidas

1. `npm ci` não concluiu devido às condições de acesso ao registro npm; `npm audit` confirmou falha DNS `EAI_AGAIN`.
2. Sem dependências instaladas, as suítes completas e emuladores não puderam efetivamente executar seus corpos de teste.
3. O Preview do Google AI Studio não foi executado.
4. Não foi realizado deploy de regras ou aplicação em produção, conforme requisito.
5. Há warnings de engine em dependências de desenvolvimento (`jsdom` e `undici`) no Node disponível neste ambiente; devem ser reavaliados em ambiente com versão de Node compatível.

## 23. Pendências para 0.6.0

A versão 0.6.0 deve concentrar-se no painel administrativo operacional, sem antecipação nesta entrega além do necessário para fotografias:

- paginação real;
- ordenação;
- filtros avançados;
- indicadores reais;
- SLA;
- ocorrências atrasadas;
- carga por responsável;
- aprimoramento do histórico;
- gestão operacional de categorias e localizações;
- aprimoramento das configurações;
- atualização em tempo real quando tecnicamente apropriada;
- relatórios administrativos básicos.
