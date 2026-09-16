# Configuração Firebase — versão 0.6.0

## Princípios

- configuração pública do SDK Web contém somente valores próprios de cliente Firebase;
- credenciais administrativas não são armazenadas no repositório;
- Firebase Admin usa identidade do runtime/ADC;
- Firestore e Storage continuam server-only;
- App Check permanece na borda da API.

## Arquivos

- `firebase.json`: fluxo local/Emulator;
- `firebase.ai-studio.json`: integração com databaseId nomeado quando aplicável ao ambiente do AI Studio;
- `firebase-applet-config.json`: configuração pública provisionada do app;
- `firebase-blueprint.json`: contrato arquitetural/documental da versão;
- `firestore.rules` / `storage.rules`: deny-all ao cliente;
- `firestore.indexes.json`: índices compostos efetivamente usados.

## Novas entidades 0.6.0

- `operationalTeams`;
- `serviceCalendars/default`;
- `serviceCalendarExceptions`;
- configuração SLA em `systemSettings/sla`;
- campos adicionais em `occurrences`, `categories`, `locations`, `adminUsers` e `auditLogs`.

## Variáveis de ambiente

Use `.env.example` apenas como referência. Não versione `.env` real. Em produção, valide explicitamente projectId, databaseId, bucket, App Check e origem permitida antes do deploy.

## Deploy

A entrega não executa deploy automaticamente. Regras, índices, aplicação e migração devem ser aplicados em ambiente de homologação antes da produção. A migração 0.6.0 não roda no startup.
