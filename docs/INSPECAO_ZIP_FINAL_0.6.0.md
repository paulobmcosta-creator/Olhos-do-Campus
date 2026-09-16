# Inspeção do ZIP final — versão 0.6.0

**Sistema:** Olhos do Campus  
**Nome oficial:** Sistema Institucional de Manutenção da Infraestrutura Física  
**Instituição:** Instituto Federal do Espírito Santo — Campus Barra de São Francisco  
**Versão:** 0.6.0

## 1. Método

O projeto foi limpo de artefatos transitórios, compactado, extraído em diretório independente e comparado byte a byte com a árvore de entrega. A inspeção também incluiu versões, estrutura, arquivos Firebase, regras, scripts, testes, documentação, marcas institucionais, termos proibidos, arquivos sensíveis, imports, JSON e sintaxe TypeScript/TSX.

O ZIP final contém o **projeto integral**, e não apenas os arquivos alterados.

## 2. Resultado da inspeção estrutural

- arquivos do projeto: **265**;
- entradas do ZIP, incluindo diretórios: **305** no pacote candidato inspecionado;
- arquivos ausentes na comparação árvore ↔ extração: **0**;
- arquivos extras: **0**;
- diferenças de hash entre árvore e extração: **0**;
- links simbólicos: **0**.

A árvore integral consta de `docs/ARVORE_DIRETORIOS.md`.

## 3. Verificação dos 30 pontos da especificação

1. **extração em diretório limpo:** concluída;
2. **versão 0.6.0:** confirmada em `package.json`, `package-lock.json`, `metadata.json`, `src/config/version.ts`, RuntimeInfo/serviço de configuração, `/api/health`, README e CHANGELOG;
3. **package-lock:** presente e identificado como 0.6.0;
4. **bun.lock:** ausente; também não há Yarn/pnpm lockfile;
5. **Firebase configs:** `firebase.json`, `firebase.ai-studio.json`, `firebase-applet-config.json` e `firebase-blueprint.json` presentes;
6. **regras:** `firestore.rules` e `storage.rules` presentes e preservando deny-all ao cliente;
7. **scripts:** scripts existentes preservados; `firebase:migrate-0.6` e `firebase:seed-campus-spaces` presentes;
8. **testes:** diretório `tests/` presente, com testes 0.6.0 de papéis, SLA, analytics, audiência, paginação, polling, exportação e administração operacional;
9. **documentação:** documentação histórica preservada e documentação ativa 0.6.0 incluída;
10. **ativos institucionais:** marcas horizontais e verticais do IFES presentes;
11. **hashes das marcas:** idênticos à base 0.5.1, sem alteração de conteúdo;
12. **node_modules:** ausente;
13. **`.env`:** ausente; apenas `.env.example` com placeholders/valores locais não secretos;
14. **credenciais privadas:** nenhum `BEGIN PRIVATE KEY`, service account, refresh token ou Bearer token encontrado;
15. **exports Firebase reais:** ausentes;
16. **cache:** ausentes `coverage`, `.vitest`, `.firebase-export`, `.worklogs` e `dist`;
17. **temporários/logs:** nenhum `.log` ou arquivo temporário de execução incluído;
18. **Atendente em contratos ativos:** ausente de `ADMIN_ROLES`, validators de criação/edição e Firebase Blueprint. O termo permanece somente onde tecnicamente necessário para detectar/bloquear dados legados, migrá-los explicitamente, testá-los ou documentar o histórico;
19. **InfraReport:** nenhuma ocorrência encontrada;
20. **reportedCategory/currentCategory:** modelo e serviço preservam `reportedCategoryId`/`reportedCategoryNameSnapshot` e categoria atual separadamente;
21. **reportedLocation/currentLocation:** modelo e serviço preservam `reportedLocation` e `location` separadamente;
22. **SLA:** domínio de horas úteis, snapshots, primeira resposta, conclusão, pausas e reabertura presente;
23. **equipes:** `operationalTeams` implementada em modelo/repositório/serviço/API/UI;
24. **calendário:** calendário semanal e exceções persistentes/configuráveis implementados;
25. **paginação:** listagem administrativa usa cursor e tamanhos 25/50/100;
26. **exports:** CSV, XLSX e PDF implementados com limite de 2.000 registros e auditoria;
27. **imports:** verificação estática encontrou **657 imports relativos** e **0 destinos ausentes** na árvore extraída;
28. **build:** o comando foi efetivamente tentado, mas não pôde ser executado porque `vite` não ficou instalado após a falha de `npm ci`; o relatório não o declara aprovado;
29. **projeto integral:** confirmado por comparação completa da árvore com a extração;
30. **documentação da limitação de testes:** registrada em `docs/TESTES_0.6.0.md`.

## 4. Marcas institucionais

Hashes SHA-256 preservados em relação à base autorizada:

- horizontal: `b4a05ce1b17a1b8f67d5190641e33ff92a405cd0fb3a06af0594c3ac05135731`;
- vertical: `a875024ca75b02d635c4b8e33ceef9f525c730a8dbde436c500cf40e11dd0427`.

Os arquivos derivados em `public/brand/` também correspondem byte a byte aos respectivos originais mantidos na base.

## 5. Segurança e termos pesquisados

Foram pesquisados:

- `BEGIN PRIVATE KEY` — 0;
- `service_account` — 0;
- `refresh_token` — 0;
- `Authorization: Bearer` — 0;
- `InfraReport` — 0;
- `100% anônimo` — 0;
- `anonimato absoluto` — 0.

A expressão `private_key` aparece somente em `tests/staticPolicy.test.ts` como **regex negativa** destinada justamente a impedir esse tipo de dado no `.env.example`.

`trackingKey` aparece nos contratos legítimos de criação/acompanhamento, hashing, testes e documentação. Não foi encontrado material real de acompanhamento dentro do pacote. A persistência da ocorrência continua utilizando hash + salt; a chave clara é devolvida somente no fluxo de criação/consulta em memória do cliente, conforme a arquitetura vigente.

O termo `Atendente` permanece deliberadamente na camada de compatibilidade legada (`LEGACY_ADMIN_ROLES`), script de migração, bloqueio de autorização, testes e documentação histórica/migratória. Ele **não é papel ativo**, não pode ser criado por validator e não aparece como papel aceito no Blueprint 0.6.0.

## 6. Firebase Web configuration

`firebase-applet-config.json` foi preservado **byte a byte** da base 0.5.1 (SHA-256 `1d88a1ef09b550bca29d939b6758a66e97efa7092f04661fc06c5e98ef86a381`). O arquivo contém a configuração pública do Firebase Web SDK, inclusive `apiKey` de cliente, que não é chave privada de service account. A 0.6.0 não inseriu credencial administrativa, senha, token de atualização ou chave privada nesse arquivo.

Credenciais do Firebase Admin continuam dependentes de ADC/identidade do runtime/variáveis seguras do ambiente.

## 7. Fotografias no pacote

Não há fotografias reais de ocorrências. As únicas imagens são:

- quatro arquivos da identidade institucional (dois caminhos derivados + dois originais);
- duas fixtures históricas de teste de EXIF/GPS, idênticas às fixtures da base 0.5.1 e utilizadas exclusivamente pelos testes de sanitização de imagens.

## 8. Verificação estática da árvore extraída

- TypeScript/TSX analisados por `transpileModule`: **168**;
- erros sintáticos: **0**;
- imports relativos: **657**;
- imports relativos ausentes: **0**;
- JSON analisados: **9**;
- erros JSON: **0**;
- uso explícito de `any` em contratos/código/testes: **0**.

Essas verificações são suplementares; não substituem `npm run typecheck`, lint, Vitest ou build com dependências instaladas.

## 9. Ambientes institucionais

A inspeção direta do seed confirmou:

- Bloco 01: **28**;
- Bloco 02: **26**;
- Bloco 03: **2**;
- Externo: **4**;
- total: **60**.

Não foi criado pavimento institucional inexistente; `sem-pavimento` é apenas nó técnico interno com nome vazio.

## 10. Limitação remanescente antes de produção

O ZIP está estruturalmente íntegro e auditado, porém **não é declarado homologado para produção**, pois o ambiente desta execução não conseguiu completar `npm ci`. Em consequência, a suíte oficial, build e Firebase Emulator Suite não ficaram disponíveis. A sequência exata a repetir em ambiente com registry, Node compatível e Java consta de `docs/TESTES_0.6.0.md`.

Nenhum deploy, migração `--apply` ou seed `--apply` em produção foi realizado.
