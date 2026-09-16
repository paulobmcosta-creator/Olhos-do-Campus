# Relatório de implementação — versão 0.4.1

## 1. Escopo

Patch corretivo para integrar a versão 0.4.0 ao Firebase efetivamente provisionado pelo Google AI Studio, preservando a arquitetura, o domínio Firestore, as regras de segurança e as funcionalidades existentes.

Fonte de verdade: ZIP `olhos-do-campus (2).zip`, recebido após a operação “Add Firebase to my app” do AI Studio.

## 2. Diagnóstico de origem

O Preview anterior apresentava:

```text
PERMISSION_DENIED: Permission denied on resource project olhos-do-campus-local
reason: CONSUMER_INVALID
service: firestore.googleapis.com
```

A inspeção confirmou três causas relacionadas:

1. `server/config/env.ts` permitia fallback para `olhos-do-campus-local` em desenvolvimento mesmo sem Emulator;
2. `server/config/firebaseAdmin.ts` utilizava `getFirestore(app)`, selecionando o database `(default)`;
3. `src/config/firebaseEnvironment.ts` presumia Emulator em modo Vite development quando `VITE_USE_FIREBASE_EMULATORS` não era definido.

O AI Studio havia provisionado:

```text
projectId = gen-lang-client-0120954905
firestoreDatabaseId = ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf
```

O arquivo `firebase-blueprint.json` criado automaticamente também divergia do modelo real da 0.4.0.

## 3. Implementação

### 3.1 Resolução de projeto e databaseId

Foi criado `server/config/firebaseRuntime.ts`, com funções puras/testáveis para:

- ler somente `projectId` e `firestoreDatabaseId` de `firebase-applet-config.json`;
- respeitar overrides de ambiente, inclusive `GOOGLE_CLOUD_PROJECT`;
- selecionar `(default)` no Emulator;
- selecionar o banco nomeado do AI Studio quando aplicável;
- rejeitar `olhos-do-campus-local` sem Emulator;
- rejeitar `FIREBASE_PROJECT_ID` e `GOOGLE_CLOUD_PROJECT` divergentes.

### 3.2 Firebase Admin SDK

`server/config/firebaseAdmin.ts` passou a utilizar:

- `getFirestore(app)` para `(default)`;
- `getFirestore(app, databaseId)` para bancos nomeados.

Auth, App Check e ADC foram preservados.

### 3.3 Frontend

`src/config/firebaseEnvironment.ts` passou a:

- usar configuração `VITE_FIREBASE_*` completa quando explicitamente fornecida;
- utilizar `firebase-applet-config.json` como fallback fora do Emulator;
- manter valores locais quando Emulator é explicitamente habilitado;
- rejeitar configuração Vite parcial;
- exigir site key do reCAPTCHA apenas se App Check estiver habilitado.

Isso evita tentativa de conexão ao Auth Emulator local no Preview do AI Studio.

### 3.4 Scripts administrativos

`firebase:bootstrap-admin`, `firebase:seed-reference-data` e `firebase:seed-demo-data` passaram a utilizar/logar o databaseId efetivamente selecionado.

As proteções contra seed acidental em ambiente real foram preservadas.

### 3.5 Regras e índices

`firebase.json` foi mantido para o fluxo local/Emulator. Foi criado `firebase.ai-studio.json` associando regras e índices ao banco nomeado do AI Studio.

Nenhuma regra permissiva foi adicionada.

### 3.6 Blueprint

`firebase-blueprint.json` foi refeito para refletir o domínio 0.4.x, incluindo:

- `trackingKeyHash`/`trackingKeySalt` sem chave clara;
- snapshot de categoria e localização;
- estados e prioridades oficiais;
- atribuição por `assignedToAdminUserId`;
- `version`;
- subcoleção de eventos;
- `lastSequence`;
- `systemSettings/operational`;
- `auditLogs`.

### 3.7 Metadados

Foi removido `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, pois o sistema não depende de Gemini para funcionamento ordinário.

### 3.8 Regressão de teste do Storage

O teste de escrita negada no Storage, removido pelo ajuste automático do AI Studio, foi restaurado com limites de retry para reduzir risco de travamento da suíte.

## 4. Compatibilidade

Não houve alteração do modelo funcional das ocorrências, protocolo, chave, eventos, categorias, localizações, configurações operacionais, papéis ou API pública/administrativa.

Nenhuma dependência foi adicionada ou removida.

## 5. Limitação técnica relevante

A seleção de banco Firestore nomeado utiliza a API correspondente do Firebase Admin SDK. A versão do projeto (`firebase-admin` 14.2.0) expõe essa capacidade. A integração deve ser novamente revisada antes de uma implantação institucional definitiva, especialmente porque o projeto permanece em fase pré-produção.

## 6. Próxima ação operacional

Após transferir a 0.4.1 ao AI Studio:

1. abrir o Preview;
2. confirmar no log o projeto e databaseId reais;
3. executar o seed explícito de dados de referência no banco nomeado;
4. testar autenticação anônima;
5. testar Google Sign-In administrativo;
6. realizar bootstrap do primeiro Administrador, se ainda não existir;
7. repetir o fluxo funcional completo de criação e acompanhamento.

## 7. Fora do escopo

Permanecem para a 0.5.0: Cloud Storage definitivo, múltiplas imagens, EXIF, redimensionamento, compressão, miniaturas, fotografia de solução e tratamento de órfãos/compensação Firestore–Storage.
