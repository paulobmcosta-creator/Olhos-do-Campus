# Cloud Storage — versão 0.5.0

## Princípio

O Cloud Storage é acessado **somente no servidor**, pelo Firebase Admin SDK. Clientes Web recebem negação integral em `storage.rules` mesmo quando autenticados.

## Objetos

```text
occurrences/{occurrenceId}/initial/{photoId}.webp
occurrences/{occurrenceId}/initial-thumbnails/{photoId}.webp
occurrences/{occurrenceId}/resolution/{photoId}.webp
occurrences/{occurrenceId}/resolution-thumbnails/{photoId}.webp
```

`occurrenceId` e `photoId` são gerados no servidor. O repository valida o path contra o padrão aceito, impedindo path traversal e nomes arbitrários.

## Metadados do objeto

- `contentType: image/webp`;
- `contentDisposition: inline` sem nome original;
- cache protegido/privado;
- custom metadata mínima: `occurrenceId`, `photoId`, `kind`, `schemaVersion`;
- sem protocolo, tracking key, e-mail, UID, IP, nome original ou dados pessoais;
- sem criação de Firebase Download Token.

## Upload

O `PhotoService` recebe bytes já extraídos do multipart, chama `ImageProcessingService`, gera IDs, grava imagem principal e miniatura e produz metadados destinados à transação Firestore. Se um upload intermediário falhar, os objetos anteriores são compensados.

## Download

- Público: `POST /api/occurrences/track/photo`, com credenciais de acompanhamento no corpo.
- Administrativo: `GET /api/admin/occurrences/:id/photos/:photoId?variant=thumbnail|full`.

A API lê o objeto pelo Admin SDK e devolve bytes WebP com `nosniff` e política de cache privada. Não são emitidas signed URLs de longa duração.

## Exclusão e rollback

A exclusão lógica antecede a exclusão física. Falhas físicas geram tarefa em `storageCleanupTasks`. Rollbacks de upload seguem o mesmo mecanismo. Consulte `TRATAMENTO_DE_ARQUIVOS_ORFAOS.md`.

## Emulator

`FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199` é obrigatório junto de Auth e Firestore Emulator. O Admin SDK utiliza a variável padrão do Emulator; o frontend é testado contra as Security Rules e continua sem acesso aos objetos.
