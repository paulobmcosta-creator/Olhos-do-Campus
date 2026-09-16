# Integração Firebase provisionada pelo Google AI Studio — versão 0.4.1

## 1. Contexto

O Google AI Studio provisionou recursos Firebase para o aplicativo **Olhos do Campus**. A integração disponibilizada no ZIP contém `firebase-applet-config.json`, com a configuração pública do Web App e os identificadores do projeto/banco.

Identificadores atualmente associados ao Preview:

- projeto Firebase/Google Cloud: `gen-lang-client-0120954905`;
- banco Firestore nomeado: `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`;
- região informada pelo provisionamento: `us-west1`.

Esses identificadores não são credenciais de serviço. Nenhuma service account, private key, token de acesso ou senha é incluída no código.

## 2. Problema corrigido

Na 0.4.0, quando o Preview não informava `FIREBASE_PROJECT_ID`/`GOOGLE_CLOUD_PROJECT` e não executava Emulator Suite, `server/config/env.ts` podia usar o fallback `olhos-do-campus-local`. Como `FIRESTORE_EMULATOR_HOST` também não existia no Preview, o Firebase Admin SDK tentava acessar `firestore.googleapis.com` com esse projeto fictício, produzindo `PERMISSION_DENIED / CONSUMER_INVALID`.

Além disso, `getFirestore(app)` selecionava o banco `(default)`, enquanto o AI Studio provisionou um databaseId nomeado.

No frontend, a ausência de `VITE_USE_FIREBASE_EMULATORS` em desenvolvimento fazia o Preview presumir Emulator Auth local, o que produziria falha posterior de autenticação.

## 3. Resolução de configuração no backend

A resolução é centralizada em `server/config/firebaseRuntime.ts`.

Ordem para o projeto:

1. `FIREBASE_PROJECT_ID`, quando informado;
2. `GOOGLE_CLOUD_PROJECT`, quando informado pelo ambiente;
3. `firebase-applet-config.json`, fora do Emulator, como fallback gerenciado;
4. `olhos-do-campus-local` somente quando Emulator estiver efetivamente configurado.

Quando `FIREBASE_PROJECT_ID` e `GOOGLE_CLOUD_PROJECT` forem informados simultaneamente, devem ser iguais.

O projeto `olhos-do-campus-local` é rejeitado fora do Emulator Suite.

## 4. Resolução do databaseId

Ordem para o banco:

1. `FIRESTORE_DATABASE_ID`, quando informado;
2. `firestoreDatabaseId` de `firebase-applet-config.json`, quando o projeto selecionado é o mesmo do arquivo gerenciado;
3. `(default)` para Emulator ou projeto externo sem banco nomeado configurado.

O Firebase Admin SDK usa `getFirestore(app, databaseId)` para bancos nomeados e `getFirestore(app)` para `(default)`.

## 5. Frontend

`src/config/firebaseEnvironment.ts` preserva override explícito por `VITE_FIREBASE_*`. Se nenhuma configuração Web completa for fornecida e o Emulator não for explicitamente ativado, o frontend utiliza os valores públicos de `firebase-applet-config.json`.

O Emulator não é mais presumido apenas porque o Vite está em modo de desenvolvimento quando existe configuração gerenciada válida do AI Studio.

`VITE_USE_FIREBASE_EMULATORS=true` continua tendo precedência para desenvolvimento local.

A site key do reCAPTCHA Enterprise somente é obrigatória quando `VITE_APP_CHECK_ENABLED=true`.

## 6. Firebase Admin e ADC

O backend preserva Application Default Credentials para ambientes reais e não aceita credencial embutida no repositório. O arquivo gerenciado do AI Studio é usado pelo backend somente para ler `projectId` e `firestoreDatabaseId`.

## 7. Emulator Suite

A configuração local permanece isolada:

```text
FIREBASE_PROJECT_ID=olhos-do-campus-local
GOOGLE_CLOUD_PROJECT=olhos-do-campus-local
FIRESTORE_DATABASE_ID=(default)
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
VITE_USE_FIREBASE_EMULATORS=true
```

O arquivo `.firebaserc` mantém `olhos-do-campus-local` como projeto padrão da CLI para reduzir risco de deploy acidental no projeto real.

## 8. Regras e índices do banco nomeado

`firebase.json` permanece adequado ao Emulator e ao database `(default)` local.

Para o banco nomeado do AI Studio foi criado `firebase.ai-studio.json`, que associa `firestore.rules` e `firestore.indexes.json` explicitamente a:

```text
ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf
```

Após revisar o projeto de destino, o deploy pode ser executado deliberadamente com:

```bash
npx firebase-tools deploy --config firebase.ai-studio.json --only firestore,storage --project gen-lang-client-0120954905
```

Nenhum deploy de produção é executado automaticamente pelo aplicativo.

## 9. Seeds

Os scripts de seed usam o mesmo `SERVER_ENV.firestoreDatabaseId` do backend.

Para o banco real, o seed de referência continua bloqueado sem confirmação explícita:

```text
ALLOW_NON_EMULATOR_REFERENCE_SEED=CONFIRM_REFERENCE_SEED
```

Antes da execução, devem ser conferidos projeto e databaseId. O seed demonstrativo continua proibido em produção e não deve ser usado como dado institucional.

## 10. Bootstrap administrativo

`firebase:bootstrap-admin` passou a resolver projeto e databaseId com a mesma lógica do servidor. O script informa no console o banco de destino antes da escrita e não imprime tokens ou credenciais.

## 11. Autenticação que deve ser conferida no ambiente provisionado

O código preserva:

- autenticação anônima no fluxo público;
- Google Sign-In na administração.

A existência do projeto e do Firestore não prova, por si só, que todos os provedores de Authentication estão habilitados no console. O teste funcional do Preview deve confirmar `signInAnonymously()` e Google Sign-In. Caso o provider anônimo esteja desabilitado externamente, ele deverá ser habilitado no Firebase Authentication sem alteração da arquitetura do sistema.

## 12. App Check

No Preview não produtivo, App Check pode permanecer desabilitado para validação de integração. Em produção, a aplicação continua falhando na inicialização se `APP_CHECK_ENFORCEMENT`/`VITE_APP_CHECK_ENABLED` não estiverem habilitados conforme a política existente.

## 13. Blueprint

O `firebase-blueprint.json` gerado inicialmente pelo AI Studio descrevia um domínio simplificado incompatível com a 0.4.0. Na 0.4.1 ele foi corrigido para refletir:

- snapshots de categoria e localização;
- estados e prioridades reais;
- `assignedToAdminUserId` em vez de `assignedTo` livre;
- subcoleção append-only de eventos;
- `lastSequence` no contador anual;
- `systemSettings/operational`;
- `auditLogs`;
- ausência de chave de acompanhamento em texto claro e de fotografias no documento da ocorrência.
