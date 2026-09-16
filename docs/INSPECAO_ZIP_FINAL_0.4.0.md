# Inspeção do ZIP final — versão 0.4.0

## 1. Procedimento

A árvore de entrega foi limpa de dependências e artefatos gerados, compactada como projeto integral e reextraída em diretório temporário independente. A inspeção utiliza o conteúdo reextraído, e não a pasta de trabalho, para confirmar a composição da entrega.

## 2. Checklist do artefato

A inspeção final confirmou:

1. `package.json` presente e versão raiz 0.4.0;
2. `package-lock.json` presente, lockfile v3 e versão raiz 0.4.0;
3. ausência de `bun.lock`, `yarn.lock` e `pnpm-lock.yaml`;
4. `firebase.json` presente;
5. `firestore.rules` presente e deny-by-default;
6. `firestore.indexes.json` presente;
7. `storage.rules` presente e deny-by-default;
8. repositórios Firestore de ocorrência, evento, categoria, localização e configuração presentes;
9. repositório/contador transacional de protocolo presente;
10. abstração temporária de fotografias presente e separada do Firestore;
11. testes unitários, API, regras e integração presentes;
12. documentação 0.4.0 presente;
13. ativos institucionais horizontal e vertical presentes;
14. hashes SHA-256 dos ativos institucionais idênticos aos arquivos do ZIP-fonte;
15. ausência de `node_modules`;
16. ausência de `.env` real;
17. ausência de arquivo de service account;
18. ausência de material de chave privada;
19. ausência de token JWT/refresh token real detectável;
20. ausência de exportação real do Firestore;
21. ausência de base de dados real de usuários;
22. ausência de arquivos `.log` no projeto;
23. ausência de cache/exportação de emuladores;
24. ausência de Data URL e bytes de imagem nos repositórios/seeds Firestore;
25. ausência de `trackingKey` em texto claro no objeto Firestore de ocorrência;
26. ausência de chave de acompanhamento em URL/query string no runtime;
27. ausência de registro da chave em logs/auditoria implementados;
28. ausência da marca vedada do projeto;
29. ausência das expressões vedadas de promessa de anonimato;
30. versão 0.4.0 coerente em `package.json`, raiz do lock, `metadata.json`, `src/config/version.ts` e `/api/health` via `APP_VERSION`;
31. ausência de `InMemoryDatabase` e dados iniciais como fonte de verdade do runtime;
32. ausência de acesso direto do frontend ao Firestore de negócio;
33. imports relativos apontam para arquivos presentes segundo a inspeção estática complementar;
34. o ZIP contém o projeto integral, e não somente arquivos alterados.

## 3. Ativos institucionais

| Arquivo | SHA-256 |
|---|---|
| `public/brand/originals/bsf-horizontal-cor.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` |
| `public/brand/ifes-bsf-horizontal.jpg` | `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731` |
| `public/brand/originals/bsf-vertical-cor.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` |
| `public/brand/ifes-bsf-vertical.jpg` | `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427` |

Os hashes coincidem com os respectivos ativos presentes no ZIP-fonte utilizado como única fonte de verdade.

## 4. Pesquisa de termos e artefatos sensíveis

A busca final foi direcionada a chaves privadas, JWTs com aparência real, arquivos de ambiente, service accounts, logs, exportações, Data URLs em persistência/seeds, `InMemoryDatabase`, símbolos `INITIAL_*`, `ENABLE_DEMO_MODE`, acesso direto de frontend ao Firestore e termos institucionais vedados.

Ocorrências textuais legítimas de termos de segurança em testes/documentação (por exemplo, nomes de campos que devem ser rejeitados) não constituem segredo. Não foi encontrado valor real de credencial.

## 5. Validação de imports e sintaxe

Como `npm ci` não concluiu no ambiente, a validação completa por `tsc` e build não pôde ser executada. Como controle auxiliar, os 128 arquivos TS/TSX foram transpilados pelo TypeScript global 5.8.3 sem erro sintático. Esse resultado **não substitui** `npm run typecheck` nem `npm run build`.

## 6. Limitação crítica

A inspeção do ZIP confirma composição, integridade estática e ausência dos artefatos proibidos verificados. Ela não converte em aprovação os testes que ficaram bloqueados pela indisponibilidade do registro npm e, consequentemente, do Firebase CLI/Vitest/Vite/ESLint locais. A situação está detalhada em `docs/TESTES_0.4.0.md`.

Por isso, o artefato é uma entrega completa da implementação 0.4.0, mas **não é declarado apto para produção** até que a suíte crítica e os testes de Emulator Suite sejam executados com sucesso em ambiente adequado.
