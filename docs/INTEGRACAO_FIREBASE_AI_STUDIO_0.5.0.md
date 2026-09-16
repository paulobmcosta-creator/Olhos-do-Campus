# Integração Firebase / Google AI Studio — versão 0.5.0

## Base recebida

O ZIP 0.4.1 utilizado como fonte de verdade contém:

```text
projectId: gen-lang-client-0120954905
firestoreDatabaseId: ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf
storageBucket: gen-lang-client-0120954905.firebasestorage.app
```

A 0.5.0 preserva o databaseId nomeado e amplia a resolução para o bucket. `firebase.ai-studio.json` continua apontando regras/índices ao database nomeado e regras ao Storage.

## Proteção contra mistura de projetos

O bucket do `firebase-applet-config.json` só é herdado quando o `projectId` ativo é o mesmo do arquivo. Se o projeto é explicitamente outro, `FIREBASE_STORAGE_BUCKET` deve ser fornecido. Da mesma forma, o databaseId do applet não é herdado de outro projeto.

O projeto `olhos-do-campus-local` é reservado ao Emulator Suite e não pode ser usado contra serviços reais.

## Preview

Checklist manual no Google AI Studio Preview:

1. confirmar `projectId`, `databaseId` e `storageBucket` efetivos;
2. confirmar Auth anônimo;
3. criar ocorrência sem fotografia;
4. criar com 1 e 3 fotografias;
5. recarregar e confirmar persistência;
6. Google Sign-In administrativo;
7. visualizar miniaturas e imagem integral;
8. adicionar foto de solução;
9. publicar explicitamente como Gestor/Administrador;
10. acompanhar com protocolo/chave e carregar foto pública;
11. confirmar que foto interna não é disponibilizada;
12. confirmar ausência de acesso direto ao bucket e ausência do projeto local.

A entrega 0.5.0 não executa deploy de produção automaticamente. Revisar o alvo antes de qualquer `firebase deploy`.
