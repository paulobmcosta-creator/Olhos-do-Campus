# Olhos do Campus

**Sistema Institucional de Manutenção da Infraestrutura Física**  
**Instituto Federal do Espírito Santo — Campus Barra de São Francisco**  
**Versão:** 0.6.2

> Ajude-nos a cuidar e melhorar os espaços do campus.

Aplicação web institucional para registro, gerenciamento e acompanhamento de ocorrências de infraestrutura física. O registro público não exige identificação pessoal obrigatória; a consulta pública exige protocolo e chave de acompanhamento.

## Hotfix 0.6.2 — contrato de bootstrap no Preview

A versão 0.6.2 corrige uma regressão de versionamento introduzida ao publicar a 0.6.1. O backend já retornava `runtime.version = 0.6.1`, porém o frontend ainda validava literalmente `0.6.0` em `RuntimeInfo` e `bootstrapResponseSchema`. Como consequência, o endpoint `/api/config` respondia corretamente, mas o cliente rejeitava o payload e exibia **“O serviço retornou dados incompatíveis com o contrato esperado.”**

A partir desta versão, o modelo e o schema Zod de bootstrap derivam de `APP_VERSION`, impedindo divergência futura entre backend, frontend e metadados. A correção de empacotamento da 0.6.1 permanece integralmente preservada.

Consulte `docs/RELATORIO_IMPLEMENTACAO_0.6.2.md` e `docs/TESTES_0.6.2.md`.

## Hotfix 0.6.1 — publicação no AI Studio / Cloud Run

A versão 0.6.1 preserva integralmente o escopo funcional da 0.6.0 e corrige somente a preparação do artefato de produção. O diagnóstico da tentativa de publicação mostrou que o AI Studio estava formando um `build_artifacts.tar.gz` truncado, com 249.560.700 bytes e 39.388 entradas em `node_modules`, incluindo ferramentas de desenvolvimento como Firebase CLI, ESLint, Vitest e jsdom.

Ao final do `npm run build`, o projeto agora executa `scripts/prepareProductionPackage.mjs`, que:

- executa `npm prune --omit=dev --no-audit --no-fund`;
- preserva as dependências de produção;
- remove `bun.lock` e `bun.lockb` caso sejam gerados pelo ambiente;
- mantém `package.json`, `package-lock.json`, `dist/`, código e configurações Firebase;
- falha explicitamente se o `npm prune` não concluir com sucesso.

A correção não altera domínio, UI, autenticação, App Check, Firestore, Storage, SLA, permissões ou modelos de dados. Consulte `docs/RELATORIO_IMPLEMENTACAO_0.6.1.md` e `docs/TESTES_0.6.1.md`.

## Escopo da versão 0.6.0

A 0.6.0 transforma o painel administrativo em ferramenta de gestão operacional, mantendo a arquitetura Firebase server-only da série 0.5.x. Esta entrega parte, por autorização expressa do usuário, do ZIP final identificado internamente como **0.5.1**; a especificação original previa 0.5.2, e essa divergência é registrada de forma explícita na documentação de migração e implementação.

Principais capacidades:

- dois papéis administrativos ativos: **Administrador** e **Gestor**;
- detecção segura de registros legados `Atendente`, sem promoção automática;
- equipes/setores responsáveis e responsável individual opcional;
- preservação da categoria e do local originalmente reportados;
- correção administrativa justificada de categoria e localização;
- catálogo administrável de categorias e locais;
- carga institucional de 60 ambientes do Campus Barra de São Francisco;
- SLA em horas úteis no timezone `America/Sao_Paulo`;
- primeira resposta por primeira mudança pública de situação;
- SLA-base de conclusão por categoria e multiplicadores por prioridade;
- pausas de SLA em `Aguardando material` e `Aguardando contratação ou serviço externo`;
- separação entre tempo total aberto e tempo efetivo de SLA;
- paginação por cursor, com páginas de 25, 50 ou 100 registros;
- filtros e ordenações administrativas;
- dashboard operacional enxuto e painel analítico separado;
- auditoria global exclusiva do Administrador;
- observações internas com audiência explícita;
- exportação CSV, XLSX e PDF com limite de segurança;
- polling administrativo de 60 segundos sem sobrescrita destrutiva;
- classificação `REAL | TEST` e expurgo físico somente de `TEST` pelo Administrador.

## Arquitetura

```text
React + TypeScript + Vite
        ↓
Express API
        ↓
Firebase App Check
        ↓
Firebase Authentication
        ↓
Autorização administrativa server-side
        ↓
Services / domínio / repositories
        ↓
Firebase Admin SDK
        ↓
Cloud Firestore + Cloud Storage
```

O cliente Web **não acessa diretamente** Firestore nem Cloud Storage. `firestore.rules` e `storage.rules` permanecem `deny-all` para clientes. Fotografias são recebidas e processadas pelo servidor, reencodadas com remoção de metadados EXIF e armazenadas no Storage por Firebase Admin.

## Papéis administrativos

### Gestor

Administra ocorrências: visualização, filtros, indicadores, exportações, situação, prioridade, correção de categoria/local, equipe, responsável, mensagens públicas, observações internas conforme audiência, duplicidade, resolução/reabertura e fotografias conforme as regras do domínio.

### Administrador

Possui todas as capacidades operacionais do Gestor e, adicionalmente, administra usuários, papéis, equipes, categorias, locais, SLA, calendário útil, parâmetros institucionais, auditoria global e expurgo de dados `TEST`.

`Atendente` não é papel ativo. Registros legados são bloqueados até que um Administrador escolha explicitamente entre converter para Gestor ou inativar.

## Dados de referência

O campus possui uma hierarquia única nesta versão:

- Bloco 01 — 28 ambientes;
- Bloco 02 — 26 ambientes;
- Bloco 03 — 2 ambientes;
- Externo — 4 ambientes;
- total — **60 ambientes**.

Não são inventados pavimentos. Internamente, a hierarquia mantém um nó técnico `sem-pavimento` com nome vazio para preservar compatibilidade do modelo.

## SLA institucional inicial

Calendário padrão:

- segunda a sexta: 09:00–19:00;
- sábado e domingo: fechado;
- timezone: `America/Sao_Paulo`;
- sem desconto automático de intervalo de almoço.

Primeira resposta: Baixa 30h; Normal 20h; Alta 10h; Urgente 4h; Emergencial 2h úteis.

Multiplicadores do SLA de conclusão: Baixa 1,50; Normal 1,00; Alta 0,80; Urgente 0,60; Emergencial 0,40.

Os SLA-base por categoria e a matriz completa estão em `docs/SLA_0.6.0.md`.

## Requisitos locais

- Node.js compatível com as dependências travadas no `package-lock.json`;
- npm 10+;
- Java/JRE quando forem utilizados Firebase Emulators por meio do Firebase CLI;
- projeto Firebase configurado por variáveis de ambiente/ADC no servidor;
- nenhuma conta de serviço, token ou chave privada deve ser incluída no repositório.

> Observação de ambiente da construção desta entrega: Node 22.16.0 gerou avisos de engine para dependências de desenvolvimento recentes (`jsdom` e `undici`). Consulte `docs/TESTES_0.6.0.md` para o resultado efetivamente observado.

## Instalação

```bash
npm ci
```

Copie `.env.example` para a configuração segura do ambiente de execução sem versionar o arquivo real. Em produção, use identidade de runtime/ADC para Firebase Admin; não grave credenciais no código.

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Validação

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm audit --omit=dev
npm run test:rules
npm run test:firebase
npm run test:storage
```

Resultados somente são considerados aprovados quando o comando foi realmente executado. O relatório desta entrega está em `docs/TESTES_0.6.0.md`.

## Seed institucional

O seed de ambientes é dry-run por padrão:

```bash
npm run firebase:seed-campus-spaces -- --dry-run
```

Para aplicar no Emulator Suite ou ambiente autorizado:

```bash
npm run firebase:seed-campus-spaces -- --apply
```

Fora dos emuladores existe trava adicional por variável de confirmação, documentada em `docs/LOCAIS_E_CORRECAO_DE_LOCAL.md`. O seed é aditivo/idempotente: cria ausências conhecidas e não renomeia nem remove silenciosamente locais já administrados.

O seed geral de referências também inclui categorias, configuração operacional, SLA e calendário:

```bash
npm run firebase:seed-reference-data
```

## Migração 0.6.0

A migração é explícita e dry-run por padrão:

```bash
npm run firebase:migrate-0.6 -- --dry-run
```

Depois de backup, conferência do projeto e revisão do relatório:

```bash
npm run firebase:migrate-0.6 -- --apply
```

A migração:

- não promove `Atendente` automaticamente;
- não transforma `department` em equipe automaticamente;
- preserva eventos e fotografias;
- preenche `reportedCategory*` e `reportedLocation` a partir do estado existente quando não houver valor anterior recuperável;
- classifica registros legados como `REAL`, salvo marcação `TEST` já explícita;
- tenta reconstruir SLA a partir de timestamps/eventos existentes;
- marca reconstruções como `CALCULATED`, `ESTIMATED` ou `UNAVAILABLE` quando necessário.

Consulte `docs/MIGRACAO_0.5.1_PARA_0.6.0.md`.

## Consulta pública e segurança

A consulta exige **protocolo + chave de acompanhamento**. A chave não é enviada na URL e não é armazenada em texto puro; o servidor armazena somente derivação com salt. A consulta pública não expõe observações internas, autores administrativos, identificadores de segurança, paths de Storage ou dados técnicos desnecessários.

## Fotografias

- fotografias iniciais permanecem internas;
- fotografias de solução podem ser publicadas conforme regra administrativa;
- processamento ocorre no servidor;
- EXIF/XMP são removidos por reencodificação;
- o cliente Web não acessa o bucket diretamente.

## Documentação ativa da 0.6.2

- `docs/ARQUITETURA.md`
- `docs/ARVORE_DIRETORIOS.md`
- `docs/MATRIZ_DE_PERMISSOES_0.6.0.md`
- `docs/SLA_0.6.0.md`
- `docs/CALENDARIO_DE_ATENDIMENTO.md`
- `docs/EQUIPES_RESPONSAVEIS.md`
- `docs/CATEGORIAS_E_RECLASSIFICACAO.md`
- `docs/LOCAIS_E_CORRECAO_DE_LOCAL.md`
- `docs/PAINEL_ADMINISTRATIVO_0.6.0.md`
- `docs/INDICADORES_0.6.0.md`
- `docs/EXPORTACOES_0.6.0.md`
- `docs/AUDITORIA_OPERACIONAL_0.6.0.md`
- `docs/MIGRACAO_0.5.1_PARA_0.6.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.6.0.md`
- `docs/TESTES_0.6.0.md`
- `docs/INSPECAO_ZIP_FINAL_0.6.0.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.6.1.md`
- `docs/TESTES_0.6.1.md`
- `docs/PUBLICACAO_AI_STUDIO_0.6.1.md`
- `docs/INSPECAO_ZIP_FINAL_0.6.1.md`
- `docs/ARQUIVOS_0.6.1.md`
- `docs/RELATORIO_IMPLEMENTACAO_0.6.2.md`
- `docs/TESTES_0.6.2.md`
- `docs/INSPECAO_ZIP_FINAL_0.6.2.md`
- `docs/ARQUIVOS_0.6.2.md`

Documentos numerados de versões anteriores são mantidos apenas como histórico e não definem o comportamento ativo da 0.6.2, salvo quando referenciados como documentação funcional preservada da 0.6.0.

## Fora do escopo da 0.6.0

Não há envio real de e-mail, SMTP, Trigger Email, Cloud Functions de notificação, ações em lote, múltiplos campi, SSE/WebSocket ou BI externo. A versão 0.7.0 permanece reservada principalmente à arquitetura de notificações reais por e-mail, outbox, idempotência, retentativas e auditoria de envio.
