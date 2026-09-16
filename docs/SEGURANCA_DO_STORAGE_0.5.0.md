# Segurança do Storage — versão 0.5.0

## Regra principal

`storage.rules` contém negação integral de leitura e escrita para clientes Firebase Web. A autenticação — anônima, Google ou administrativa — não concede acesso direto ao bucket.

## API protegida

### Upload público
App Check → ID Token Firebase → usuário anônimo → parser multipart limitado → validação de domínio → processamento autoritativo → Admin SDK Storage.

### Download público
App Check → ID Token anônimo → protocolo + tracking key → foto `RESOLUTION/PUBLIC/READY` → Admin SDK Storage → bytes.

### Administração
App Check → ID Token Google → `adminUsers` ativo → papel → acesso à ocorrência → operação solicitada.

Atendente só acessa ocorrência atribuída. Gestor e Administrador podem publicar/excluir; Atendente não pode.

## Enumeração e vazamento

Fotografia interna e `photoId` inexistente retornam comportamento genérico de não encontrado no endpoint público. Erros não revelam path/bucket. A chave de acompanhamento nunca aparece em URL. Não há signed URL persistente nem Firebase Download Token.

## Logs

Não registrar buffers, Base64, EXIF original, tracking key, ID Token, App Check Token ou nome original. Logs podem conter occurrenceId, photoId, etapa, tamanho final, código de erro e correlationId.

## Security Rules

Os testes de Rules cobrem read/write/delete/list do Storage por contexto não autenticado, anônimo, Google e administrativo, todos negados. Firestore também nega acesso direto a `occurrences/{id}/photos` e `storageCleanupTasks`.
