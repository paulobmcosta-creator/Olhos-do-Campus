# Inspeção do ZIP final — versão 0.4.1

Data: **2026-08-13**.

## 1. Procedimento

A árvore candidata à entrega foi compactada integralmente, excluindo somente artefatos que não pertencem ao projeto (`node_modules`, `dist`, cobertura, caches, exportações de emuladores, `.env` real, logs e `bun.lock`). O pacote foi extraído em diretório temporário independente e comparado arquivo a arquivo com a árvore de trabalho.

Após a inclusão deste próprio relatório, o ZIP final foi reconstruído e submetido novamente às mesmas verificações estruturais, de integridade e de segurança.

## 2. Integridade estrutural

- arquivos no projeto final: **190**;
- caminhos no ZIP e na árvore de trabalho: **idênticos**;
- divergências SHA-256 entre arquivos da árvore e arquivos reextraídos: **0**;
- `package.json`: presente e versão 0.4.1;
- `package-lock.json`: presente, versão raiz 0.4.1 e dependências da raiz coerentes com `package.json`;
- `metadata.json`: presente e versão 0.4.1;
- `firebase.json`: presente;
- `firebase.ai-studio.json`: presente;
- `firebase-applet-config.json`: presente e byte a byte idêntico ao recebido do AI Studio;
- `firebase-blueprint.json`: presente e alinhado ao domínio 0.4.x;
- `firestore.rules`: presente;
- `firestore.indexes.json`: presente;
- `storage.rules`: presente;
- novos arquivos de runtime/testes/documentação da 0.4.1: presentes.

## 3. Projeto e banco Firebase

Confirmado no pacote:

```text
projectId: gen-lang-client-0120954905
firestoreDatabaseId: ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf
```

`firebase.ai-studio.json` referencia explicitamente o mesmo databaseId nomeado. `firebase.json` permanece destinado ao fluxo local/Emulator.

O backend contém fail-fast para impedir `olhos-do-campus-local` fora do Emulator Suite.

## 4. Ativos institucionais

Os quatro arquivos institucionais foram comparados com a fonte de verdade recebida:

| Arquivo | SHA-256 | Resultado |
|---|---|---|
| `public/brand/ifes-bsf-horizontal.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` | idêntico |
| `public/brand/ifes-bsf-vertical.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` | idêntico |
| `public/brand/originals/bsf-horizontal-cor.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` | idêntico |
| `public/brand/originals/bsf-vertical-cor.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` | idêntico |

## 5. Verificações de segurança e higiene

Foram confirmados:

1. ausência de `node_modules`;
2. ausência de `dist`;
3. ausência de `bun.lock`;
4. ausência de `.env` real;
5. ausência de service account;
6. ausência de private key;
7. ausência de JWT/ID Token literal detectável;
8. ausência de refresh token;
9. ausência de logs;
10. ausência de exportações reais do Firestore;
11. ausência de cache/exportação de emuladores;
12. ausência de dados reais de usuários adicionados pela 0.4.1;
13. ausência da marca vedada por especificação;
14. ausência de promessa percentual de anonimato;
15. ausência de promessa de anonimato irrestrito;
16. ausência de chave de acompanhamento em query string;
17. ausência de Data URL nos repositórios Firestore e seeds;
18. ausência de `trackingKey` em texto claro no objeto Firestore de ocorrência;
19. `firestore.rules` permanece `allow read, write: if false`;
20. `storage.rules` permanece `allow read, write: if false`;
21. frontend sem importação direta de `firebase/firestore` ou `firebase-admin/firestore`;
22. `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` ausente de `metadata.json` — referências restantes existem apenas no changelog, relatório e teste que comprovam sua remoção;
23. `firebase-applet-config.json` preservado sem utilização de sua configuração Web como credencial administrativa;
24. nenhum `any` inadequado encontrado em `src`, `server`, `scripts` ou `tests`.

## 6. Integridade de código complementar

Como as dependências npm não puderam ser instaladas neste ambiente, foram repetidas verificações estruturais independentes:

- **128** arquivos TS/TSX transpilados sintaticamente com TypeScript 5.8.3;
- erros sintáticos: **0**;
- imports relativos ausentes: **0**;
- arquivos JSON centrais parseados: **8/8**;
- teste semântico independente de `firebaseRuntime.ts`: **PASS**.

Essas verificações não substituem `npm run typecheck`, ESLint, Vitest, build ou Emulator Suite. A limitação completa está registrada em `docs/TESTES_0.4.1.md`.

## 7. Checklist final da entrega

| # | Verificação | Resultado |
|---:|---|---|
| 1 | ZIP reextraído em diretório novo | aprovado |
| 2 | árvore integral listada/documentada | aprovado |
| 3 | `package.json` 0.4.1 | aprovado |
| 4 | `package-lock.json` 0.4.1 | aprovado |
| 5 | ausência de `bun.lock` | aprovado |
| 6 | `firebase.json` presente | aprovado |
| 7 | configuração específica do banco nomeado presente | aprovado |
| 8 | `firestore.rules` presente e restritivo | aprovado |
| 9 | `firestore.indexes.json` presente | aprovado |
| 10 | `storage.rules` presente e restritivo | aprovado |
| 11 | resolver Firebase 0.4.1 presente | aprovado |
| 12 | testes 0.4.1 presentes | aprovado |
| 13 | documentação 0.4.1 presente | aprovado |
| 14 | ativos institucionais presentes | aprovado |
| 15 | hashes dos ativos preservados | aprovado |
| 16 | ausência de `node_modules` | aprovado |
| 17 | ausência de `.env` real | aprovado |
| 18 | ausência de service account/private key | aprovado |
| 19 | ausência de tokens reais detectáveis | aprovado |
| 20 | ausência de exportações Firestore | aprovado |
| 21 | ausência de base real de usuários | aprovado |
| 22 | ausência de logs | aprovado |
| 23 | ausência de cache de emuladores | aprovado |
| 24 | ausência de Data URL em persistência Firestore | aprovado |
| 25 | chave de acompanhamento não persistida em texto claro | aprovado |
| 26 | chave de acompanhamento não presente em URL | aprovado |
| 27 | marca vedada ausente | aprovado |
| 28 | promessas indevidas de anonimato ausentes | aprovado |
| 29 | versão 0.4.1 coerente | aprovado |
| 30 | imports relativos existentes | aprovado |
| 31 | build não referencia import relativo inexistente | aprovado por inspeção estrutural; build completo bloqueado neste ambiente |
| 32 | ZIP contém o projeto integral | aprovado |
| 33 | projectId real do AI Studio reconhecido | aprovado |
| 34 | databaseId nomeado reconhecido | aprovado |
| 35 | projeto local sem Emulator é rejeitado | aprovado em teste semântico independente |
| 36 | metadado Gemini indevido removido | aprovado |
| 37 | teste de escrita negada no Storage restaurado | aprovado por inspeção do teste; execução depende do Emulator |

## 8. Conclusão

A inspeção estrutural e de segurança do pacote final foi concluída sem divergências de conteúdo entre a árvore candidata e o ZIP reextraído. A única ressalva da entrega é de **execução da suíte**, não de integridade do ZIP: as dependências npm não puderam ser instaladas neste ambiente. Assim, a 0.4.1 deve ter `npm ci`, validação completa e testes de Emulator repetidos no Google AI Studio antes de qualquer classificação como apta para produção.
