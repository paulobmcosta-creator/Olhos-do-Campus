# Regras de segurança — versão 0.5.0

## Firestore

A arquitetura permanece server-only. As regras não concedem leitura/escrita a clientes Web, inclusive em:

- `occurrences` e subcoleções `events` e `photos`;
- `storageCleanupTasks`;
- `adminUsers`;
- `auditLogs`;
- referências/configuração.

O backend usa Admin SDK após validar App Check, Auth e autorização.

## Storage

```text
match /{allPaths=**} {
  allow read, write: if false;
}
```

Não existe exceção por `request.auth != null`. A mesma negação vale para usuário anônimo, Google autenticado e administrador.

## Testes

`tests/firebaseRules.test.ts` cobre Firestore e Storage; o Storage é testado para leitura, escrita, exclusão e listagem em diferentes contextos de autenticação. O servidor é testado separadamente no Storage Emulator por Admin SDK.
