# Regras de segurança — versão 0.4.1

## 1. Princípio preservado

A 0.4.1 não altera o modelo server-only da 0.4.0. Clientes Web continuam sem acesso direto às coleções de negócio do Firestore e ao Cloud Storage. `firestore.rules` e `storage.rules` permanecem deny-by-default.

## 2. Correção de configuração

A principal mudança de segurança é impedir que `olhos-do-campus-local` seja utilizado contra APIs reais do Google. Esse projectId só é aceito quando Auth e Firestore Emulator estão configurados conjuntamente.

## 3. Banco nomeado

O backend seleciona explicitamente o `firestoreDatabaseId` resolvido. Para o ambiente atualmente provisionado pelo Google AI Studio:

```text
projectId: gen-lang-client-0120954905
databaseId: ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf
```

`firebase.ai-studio.json` associa regras/índices a esse banco nomeado. `firebase.json` continua destinado ao Emulator local.

## 4. Credenciais

Nenhuma service account, private key, senha, ID Token ou App Check debug token é incluído no código. O backend continua utilizando Application Default Credentials no acesso real.

`firebase-applet-config.json` é um arquivo de configuração pública do Web App gerenciado pelo AI Studio. O backend lê somente `projectId` e `firestoreDatabaseId`; não utiliza `apiKey`, OAuth client ID ou outros valores do arquivo para obter privilégios administrativos.

## 5. Frontend

O frontend aceita configuração Web completa por `VITE_FIREBASE_*` ou, fora do Emulator, o arquivo gerenciado do AI Studio. Configuração explícita parcial é rejeitada para evitar mistura silenciosa entre projetos.

App Check continua obrigatório em produção. A site key do reCAPTCHA Enterprise é exigida apenas quando App Check do frontend estiver habilitado.

## 6. Authentication

A arquitetura permanece:

- sessão pública: Firebase Authentication anônima;
- administração: Google Sign-In;
- verificação do ID Token no backend;
- autorização adicional por `adminUsers`.

O provisionamento do projeto Firebase deve ser acompanhado de teste funcional dos providers externos; a existência do Firestore não substitui essa validação.

## 7. Storage

Storage continua fora do escopo da 0.4.1. O teste de regras volta a comprovar explicitamente:

- escrita negada;
- leitura negada;
- listagem negada;

para usuário não autenticado, anônimo e Google autenticado.

## 8. Seeds e bootstrap

Seeds e bootstrap usam a mesma resolução de projeto/databaseId do backend. Seeds fora do Emulator continuam exigindo confirmação explícita e o seed demonstrativo permanece proibido em produção.

## 9. Chave de acompanhamento

Não houve alteração na proteção da chave: geração criptograficamente segura, `scrypt`, salt por ocorrência, comparação segura, ausência de texto claro no Firestore, URL e logs.
