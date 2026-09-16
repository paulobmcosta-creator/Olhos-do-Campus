# Metadados de fotografias — versão 0.5.0

## Firestore

Caminho: `occurrences/{occurrenceId}/photos/{photoId}`.

Modelo persistido:

```text
schemaVersion: 1
kind: INITIAL | RESOLUTION
visibility: INTERNAL | PUBLIC
status: READY | DELETED
storagePath: string
thumbnailStoragePath: string
contentType: image/webp
width: number
height: number
byteSize: number
thumbnailByteSize: number
sha256: string
createdAt: Timestamp
createdByType: PUBLIC | ADMIN
createdByAdminUserId?: string
createdByRoleSnapshot?: string
deletedAt?: Timestamp
deletedByAdminUserId?: string
```

Os paths e checksum são internos. Não existem bytes/Base64/Data URL, nome original, IP, protocolo ou chave de acompanhamento no documento.

## DTO administrativo

Expõe: `id`, `kind`, `visibility`, `status`, dimensões, tamanho e data. Não expõe paths, bucket, SHA-256 ou identificadores do ator.

## DTO público

Somente fotografias `RESOLUTION + PUBLIC + READY`: `id`, `kind`, `createdAt`, `width`, `height`.

## Storage custom metadata

Somente identificadores técnicos mínimos: occurrenceId, photoId, kind, schemaVersion. Não é criada metadata de download token público.
